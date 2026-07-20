import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font } from '../theme';

interface DateFieldProps {
  label: string;
  // the date as "YYYY-MM-DD" (or a full ISO string). Empty means no date.
  value?: string;
  onChange: (value: string | undefined) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// keeps only the "YYYY-MM-DD" part of the value and drops the time if there is one
function toYmd(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? match[0] : undefined;
}

// turns a Date into a "YYYY-MM-DD" string using the local day (no timezone problems)
function fromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// turns a "YYYY-MM-DD" string back into a Date at midnight
function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selectedYmd = toYmd(value);
  const today = new Date();
  const todayYmd = fromDate(today);

  // which month the calendar shows. We start on the selected date, or today if there is none.
  const seed = selectedYmd ? parseYmd(selectedYmd) : today;
  const [view, setView] = useState({ year: seed.getFullYear(), month: seed.getMonth() });

  const locale = i18n.language || undefined;

  const weekdays = useMemo(() => {
    // Jan 1 2023 was a Sunday, so starting there gives us the 7 day letters in order.
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }),
    );
  }, [locale]);

  const monthTitle = new Date(view.year, view.month, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  const cells = useMemo(() => {
    const firstWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      out.push(fromDate(new Date(view.year, view.month, day)));
    }
    return out;
  }, [view]);

  const displayLabel = selectedYmd
    ? parseYmd(selectedYmd).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : t('expiry.noDate');

  const openPicker = () => {
    const base = selectedYmd ? parseYmd(selectedYmd) : today;
    setView({ year: base.getFullYear(), month: base.getMonth() });
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const pick = (ymd: string) => {
    onChange(ymd);
    setOpen(false);
  };

  const pickRelative = (days: number) => {
    pick(fromDate(new Date(Date.now() + days * MS_PER_DAY)));
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={t('dateField.a11y', { label })}
      >
        <Text style={[styles.value, !selectedYmd && styles.valueEmpty]}>{displayLabel}</Text>
        <View style={styles.inputIcons}>
          {selectedYmd ? (
            <TouchableOpacity
              onPress={() => onChange(undefined)}
              accessibilityRole="button"
              accessibilityLabel={t('dateField.clear')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdropWrap}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel={t('common.close')}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
            <View style={styles.handle} />

            <View style={styles.monthHeader}>
              <TouchableOpacity
                onPress={() => shiftMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel={t('dateField.prevMonth')}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={colors.charcoal} />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <TouchableOpacity
                onPress={() => shiftMonth(1)}
                accessibilityRole="button"
                accessibilityLabel={t('dateField.nextMonth')}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={22} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {weekdays.map((w, i) => (
                <Text key={i} style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((ymd, i) => {
                if (!ymd) return <View key={`b${i}`} style={styles.cell} />;
                const isSelected = ymd === selectedYmd;
                const isToday = ymd === todayYmd;
                return (
                  <TouchableOpacity
                    key={ymd}
                    style={styles.cell}
                    onPress={() => pick(ymd)}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isToday && styles.dayToday,
                        isSelected && styles.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isToday && !isSelected && styles.dayTextToday,
                        ]}
                      >
                        {Number(ymd.slice(8, 10))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.chipsRow}>
              <TouchableOpacity style={styles.chip} onPress={() => onChange(undefined)}>
                <Text style={styles.chipText}>{t('dateField.clear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => pickRelative(3)}>
                <Text style={styles.chipText}>{t('dateField.in3Days')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => pickRelative(7)}>
                <Text style={styles.chipText}>{t('dateField.in1Week')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => pickRelative(30)}>
                <Text style={styles.chipText}>{t('dateField.in1Month')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  value: { fontSize: 16, color: '#111' },
  valueEmpty: { color: '#aaa' },
  inputIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceGray,
    marginTop: 10,
    marginBottom: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.charcoal,
    textTransform: 'capitalize',
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: colors.leafGreen },
  daySelected: { backgroundColor: colors.leafGreen },
  dayText: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  dayTextSelected: { color: colors.onBrand },
  dayTextToday: { color: colors.forestGreen },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.creamSurface,
  },
  chipText: { fontSize: 13, fontFamily: font.semibold, color: colors.charcoal },
});
