import { Text, TextInput } from 'react-native';

// Every StyleSheet in this app sets `fontWeight` (600/700/800/900) but never a
// custom `fontFamily` — the whole UI has always rendered in whatever system font
// the OS ships, which is the single biggest reason the app read as "unstyled."
//
// Expo's Google Fonts packages load each weight as its own distinct font family
// (e.g. "PlusJakartaSans_700Bold"), and React Native does NOT synthesize other
// weights from a custom font the way it does for system fonts — setting
// `fontFamily` once and leaving `fontWeight` as-is silently renders every weight
// identically (worse on iOS than Android, per RN's long-standing font-weight
// limitation with custom fonts). Rather than touch fontWeight in ~40 files, this
// module patches Text/TextInput's default style resolution once, at the root, to
// pick the correct loaded family for whatever fontWeight is already declared —
// every existing screen gets real typographic weight for free.

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '400': 'PlusJakartaSans_600SemiBold', // nothing in this app uses 400, but default safely
  '500': 'PlusJakartaSans_600SemiBold',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold', // family tops out at ExtraBold; closest available cut
};

const DEFAULT_FAMILY = 'PlusJakartaSans_600SemiBold';

function flattenStyle(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  return style;
}

function resolveFamily(style: any): string {
  const flat = flattenStyle(style);
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : null;
  if (weight && WEIGHT_TO_FAMILY[weight]) return WEIGHT_TO_FAMILY[weight];
  return DEFAULT_FAMILY;
}

let patched = false;

export function applyGlobalFont() {
  if (patched) return;
  patched = true;

  const TextRender = (Text as any).render;
  if (TextRender) {
    (Text as any).render = function (this: any, props: any, ref: any) {
      const family = resolveFamily(props.style);
      const merged = { ...props, style: [{ fontFamily: family }, props.style] };
      return TextRender.call(this, merged, ref);
    };
  }

  const InputRender = (TextInput as any).render;
  if (InputRender) {
    (TextInput as any).render = function (this: any, props: any, ref: any) {
      const family = resolveFamily(props.style);
      const merged = { ...props, style: [{ fontFamily: family }, props.style] };
      return InputRender.call(this, merged, ref);
    };
  }
}
