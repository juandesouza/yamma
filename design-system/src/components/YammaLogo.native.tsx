import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { YammaLogoProps } from './YammaLogo.shared';

export type { YammaLogoProps } from './YammaLogo.shared';

/**
 * Expo Go does not expose `RNSVGLinearGradient` for react-native-svg’s Fabric path;
 * gradient text uses expo-linear-gradient + MaskedView instead (same colors as web SVG).
 */
export function YammaLogo({
  width = 140,
  height = 28,
}: YammaLogoProps) {
  const fontSize = Math.max(12, height * 0.72);
  const letterSpacing = fontSize * (-1 / 72);

  return (
    <MaskedView
      accessibilityRole="image"
      accessibilityLabel="Yamma"
      style={{ width, height }}
      maskElement={
        <View style={[styles.mask, { width, height }]}>
          <Text
            style={[
              styles.maskText,
              {
                fontSize,
                lineHeight: height,
                letterSpacing,
              },
            ]}
          >
            Yamma
          </Text>
        </View>
      }
    >
      <LinearGradient
        colors={['#FF8A00', '#FF4D00']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width, height }}
      />
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  maskText: {
    fontWeight: '700',
    color: '#000',
    includeFontPadding: false,
  },
});
