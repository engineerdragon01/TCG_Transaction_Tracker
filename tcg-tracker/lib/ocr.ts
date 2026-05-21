// OCR layer.
//
// IMPORTANT — Expo Go does NOT include native OCR. To get real on-device text
// recognition you'll need to create a dev build (`npx expo prebuild` or EAS Build)
// and install one of:
//
//   • @react-native-ml-kit/text-recognition  (Google ML Kit, on-device, free)
//   • react-native-vision-camera + vision-camera-ocr  (live frame OCR)
//
// Until then, recognizeText() returns null and the UI falls back to a manual
// "type the card name" input. The downstream pipeline (parseOcrText →
// searchCards) works identically once OCR text is available.
//
// To wire up ML Kit after a dev build, replace the body of recognizeText with:
//
//   import TextRecognition from '@react-native-ml-kit/text-recognition';
//   const result = await TextRecognition.recognize(imageUri);
//   return result.text;

export interface RecognizeOptions {
  imageUri: string;
}

export async function recognizeText(_opts: RecognizeOptions): Promise<string | null> {
  // Stub. See module docstring for how to enable real OCR.
  return null;
}

export const OCR_AVAILABLE = false;
