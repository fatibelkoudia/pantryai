import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buttonLip, colors, font } from '../../src/theme';
import type { IoniconName } from '../../src/lib/foodIcons';

// Active tab gets a little green pill behind a filled icon, like the mockups.
function TabIcon({
  focused,
  outline,
  filled,
}: {
  focused: boolean;
  outline: IoniconName;
  filled: IoniconName;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={focused ? filled : outline}
        size={20}
        color={focused ? colors.onBrand : colors.textMuted}
      />
    </View>
  );
}

// The five tabs from the dashboard design: Home, Inventory, Recipes, Shopping, Learn.
// Profile lives behind the avatar in the Home header, and Scan behind the header buttons,
// so neither needs a tab.
export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forestGreen,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontFamily: font.semibold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="home-outline" filled="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t('nav.inventory'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              outline="file-tray-stacked-outline"
              filled="file-tray-stacked"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: t('nav.recipes'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="restaurant-outline" filled="restaurant" />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: t('nav.shopping'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="basket-outline" filled="basket" />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: t('nav.learn'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="school-outline" filled="school" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 48,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    ...buttonLip,
    backgroundColor: colors.leafGreen,
  },
});
