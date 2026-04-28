// 한글 주석: V2 Button 컴포넌트
//
// ▣ 변형:
//   - primary: 에메랄드 배경 + 미묘한 글로우 (CTA)
//   - ghost  : 투명 배경 + 라인 보더 (보조 액션)
//   - text   : 배경 없음 (텍스트 링크 같은 느낌)
// ▣ 사이즈: sm / md / lg

import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native'
import { ReactNode } from 'react'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'
import { ctaShadow } from '@/constants/shadows'

export type ButtonVariant = 'primary' | 'ghost' | 'text'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  style?: ViewStyle
  /** 풀폭 사용 (탭 스크린의 큰 CTA용) */
  fullWidth?: boolean
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  fullWidth = false,
}: ButtonProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    sizeMap[size],
    variantMap[variant].container,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[]

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        ...containerStyle,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantMap[variant].textColor}
        />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              typography.buttonPrimary,
              { color: variantMap[variant].textColor },
              size === 'sm' && typography.buttonSmall,
            ]}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// 사이즈별 스타일
// ─────────────────────────────────────────────

const sizeMap: Record<ButtonSize, ViewStyle> = {
  sm: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 32,
    borderRadius: radius.sm,
  },
  md: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 44,
    borderRadius: radius.md,
  },
  lg: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    minHeight: 52,
    borderRadius: radius.md,
  },
}

// ─────────────────────────────────────────────
// 변형별 스타일
// ─────────────────────────────────────────────

const variantMap: Record<
  ButtonVariant,
  { container: ViewStyle; textColor: string }
> = {
  primary: {
    container: {
      backgroundColor: colors.brand[500],
      ...ctaShadow,
    },
    textColor: colors.onBrand,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.line.strong,
    },
    textColor: colors.text.primary,
  },
  text: {
    container: {
      backgroundColor: 'transparent',
    },
    textColor: colors.brand[400],
  },
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
})
