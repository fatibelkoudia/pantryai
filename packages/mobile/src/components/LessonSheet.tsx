import { Ionicons } from '@expo/vector-icons';
import type { CompleteLessonResponse, Locale } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../api/client';
import { buttonLip, colors, font } from '../theme';
import { BottomSheet } from './BottomSheet';

interface LessonSheetProps {
  // id of the tip to open, or null when the sheet is closed
  tipId: string | null;
  onClose: () => void;
}

// The interactive lesson: opens a tip as a bottom sheet with a one-question quiz.
// Pick an answer, check it, read the reveal and earn the XP. Lessons without a
// quiz (generation failed) fall back to read-and-confirm, and lessons already
// done open in review mode.
export function LessonSheet({ tipId, onClose }: LessonSheetProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale: Locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<CompleteLessonResponse | null>(null);
  // a lesson starts on the tip so people read it first, then they move to the quiz
  const [phase, setPhase] = useState<'read' | 'quiz'>('read');

  // fresh state every time a different lesson opens
  useEffect(() => {
    setPicked(null);
    setResult(null);
    setPhase('read');
  }, [tipId]);

  const lesson = useQuery({
    queryKey: ['learning', 'lesson', tipId, locale],
    queryFn: () => apiClient.getLesson(tipId as string, locale),
    enabled: tipId != null,
    // first open can take a few seconds (the quiz is being generated), so don't
    // throw the answer away the moment the sheet closes
    staleTime: 60 * 60 * 1000,
  });

  const complete = useMutation({
    mutationFn: (answerIndex?: number) =>
      apiClient.completeLesson(tipId as string, answerIndex, locale),
    onSuccess: (data) => {
      setResult(data);
      // refresh XP, streak, challenge progress and the lessons list everywhere
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
      void queryClient.invalidateQueries({ queryKey: ['learning', 'lessons'] });
    },
  });

  const detail = lesson.data?.lesson;
  const quiz = detail?.quiz ?? null;
  const reviewMode = detail?.completed === true && result === null;
  const revealed = result !== null;

  const choiceStyle = (index: number) => {
    if (!revealed) {
      return picked === index ? [styles.choice, styles.choicePicked] : styles.choice;
    }
    if (result?.answerIndex === index) return [styles.choice, styles.choiceRight];
    if (picked === index) return [styles.choice, styles.choiceWrong];
    return styles.choice;
  };

  return (
    <BottomSheet
      visible={tipId != null}
      title={detail ? t(`learn.categories.${detail.category}`) : t('learn.title')}
      onClose={onClose}
    >
      {lesson.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.leafGreen} />
          <Text style={styles.muted}>{t('lesson.preparing')}</Text>
        </View>
      ) : lesson.isError || !detail ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>{t('lesson.error')}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => lesson.refetch()}>
            <Text style={styles.primaryButtonText}>{t('learn.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : reviewMode || quiz === null ? (
        // plain fact view: review mode, or no quiz could be generated
        <View style={styles.body}>
          <Text style={styles.lessonTitle}>{detail.title}</Text>
          <Text style={styles.lessonBody}>{detail.body}</Text>
          <SourceLink source={detail.source} url={detail.sourceUrl} />

          {reviewMode ? (
            <View style={styles.doneNote}>
              <Ionicons name="checkmark-circle" size={18} color={colors.leafGreen} />
              <Text style={styles.doneNoteText}>{t('lesson.completedBefore')}</Text>
            </View>
          ) : revealed ? (
            <ResultBanner result={result} correctLabel={t('lesson.gotIt')} />
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={complete.isPending}
              onPress={() => complete.mutate(undefined)}
            >
              <Text style={styles.primaryButtonText}>
                {t('lesson.gotIt')} {t('learn.xpChip', { count: detail.xp })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : phase === 'read' ? (
        // read the tip first, the quiz comes after
        <View style={styles.body}>
          <Text style={styles.lessonTitle}>{detail.title}</Text>
          <Text style={styles.lessonBody}>{detail.body}</Text>
          <SourceLink source={detail.source} url={detail.sourceUrl} />
          <Text style={styles.readHint}>{t('lesson.readHint')}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setPhase('quiz')}>
            <Text style={styles.primaryButtonText}>{t('lesson.quizMe')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // the quiz view
        <View style={styles.body}>
          <Text style={styles.kicker}>{t('lesson.question')}</Text>
          <Text style={styles.lessonTitle}>{quiz.question}</Text>

          <View style={styles.choices}>
            {quiz.choices.map((choice, index) => (
              <TouchableOpacity
                key={choice}
                style={choiceStyle(index)}
                disabled={revealed || complete.isPending}
                onPress={() => setPicked(index)}
                accessibilityRole="button"
                accessibilityState={{ selected: picked === index }}
              >
                <Text style={styles.choiceText}>{choice}</Text>
                {revealed && result?.answerIndex === index ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.forestGreen} />
                ) : revealed && picked === index ? (
                  <Ionicons name="close-circle" size={20} color={colors.brickRed} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {revealed ? (
            <>
              <ResultBanner result={result} correctLabel={t('lesson.correct')} />
              {result.explanation ? (
                <Text style={styles.lessonBody}>{result.explanation}</Text>
              ) : null}
              <SourceLink source={detail.source} url={detail.sourceUrl} />
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, picked === null && styles.buttonDisabled]}
              disabled={picked === null || complete.isPending}
              onPress={() => complete.mutate(picked ?? undefined)}
            >
              <Text style={styles.primaryButtonText}>{t('lesson.checkAnswer')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </BottomSheet>
  );
}

// The tip's source, tappable so people can open the ANSES/ADEME page it came from.
function SourceLink({ source, url }: { source: string; url: string }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={() => void Linking.openURL(url)} accessibilityRole="link">
      <Text style={styles.source}>{t('lesson.source', { source })} ↗</Text>
    </TouchableOpacity>
  );
}

// The little banner under a finished lesson: right/wrong verdict plus the XP that
// was just earned (nothing when the lesson had already been done before).
function ResultBanner({
  result,
  correctLabel,
}: {
  result: CompleteLessonResponse;
  correctLabel: string;
}) {
  const { t } = useTranslation();
  const wrong = result.correct === false;

  return (
    <View style={[styles.resultBanner, wrong ? styles.resultWrong : styles.resultRight]}>
      <Text style={[styles.resultText, wrong ? styles.resultTextWrong : styles.resultTextRight]}>
        {wrong ? t('lesson.incorrect') : correctLabel}
      </Text>
      {result.xpAwarded > 0 ? (
        <View style={styles.xpChip}>
          <Text style={styles.xpChipText}>{t('learn.xpChip', { count: result.xpAwarded })}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  body: { gap: 12, paddingBottom: 8 },
  kicker: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lessonTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  lessonBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  readHint: { fontSize: 13, fontFamily: font.semibold, color: colors.forestGreen, marginTop: 4 },
  source: { fontSize: 11, color: colors.forestGreen, textDecorationLine: 'underline' },
  choices: { gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.creamSurface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.creamSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choicePicked: { borderColor: colors.leafGreen, backgroundColor: colors.softMint },
  choiceRight: { borderColor: colors.leafGreen, backgroundColor: colors.softMint },
  choiceWrong: { borderColor: colors.brickRed, backgroundColor: colors.redTint },
  choiceText: { flex: 1, fontSize: 14, fontFamily: font.semibold, color: colors.charcoal },
  primaryButton: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.bold },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resultRight: { backgroundColor: colors.softMint },
  resultWrong: { backgroundColor: colors.redTint },
  resultText: { fontSize: 15, fontFamily: font.bold },
  resultTextRight: { color: colors.forestGreen },
  resultTextWrong: { color: colors.redText },
  doneNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneNoteText: { fontSize: 13, color: colors.textMuted },
  xpChip: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  xpChipText: { fontSize: 12, fontFamily: font.bold, color: colors.amberText },
});
