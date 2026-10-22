// The tag reader of "Vincular etiqueta" (and, later, "Verificar obra" and
// "Confirmar recebimento"): the point of extension for real NFC.
//
// Today the app ships ONLY the manual reader: the person pastes or types the
// URL the tag writes (`…?uid=&ctr=&cmac=`) — the same field of the web
// `/certification/link/[artworkId]`. Reading the NTAG 424 DNA needs native
// code (`react-native-nfc-manager`) and a development build, which this
// package does not add (Expo Go has no NFC). To plug it:
//
//   1. `npx expo install react-native-nfc-manager` and add its config plugin
//      to app.json (iOS: "NFCReaderUsageDescription" + the
//      com.apple.developer.nfc.readersession.formats entitlement "NDEF").
//   2. Implement `nfcReader` below with NfcManager.start(),
//      requestTechnology(NfcTech.Ndef), read the first URI record of
//      getTag().ndefMessage (Ndef.uri.decodePayload) and return it as `url`;
//      always cancelTechnologyRequest() in `finally`.
//   3. Return it from `tagReader()` when NfcManager.isSupported() resolves true.
//   4. Build with `npx expo run:ios|android` or EAS (README › Build com EAS).
//
// The screen never parses bytes: it gets a URL and hands it to the same
// parser of the manual path (`parseSunUrl`), so the server sees the same
// `{ uid, ctr, cmac }` either way.

export interface TagRead {
  /** The URL the tag carries (SUN message in the query). */
  url: string
}

export interface TagReader {
  /** 'manual' = the person pastes the URL; 'nfc' = the phone reads the tag. */
  kind: 'manual' | 'nfc'
  /** Whether this reader can scan by itself (false for the manual one). */
  canScan: boolean
  /** Waits for a tap; resolves with the read or null when cancelled. The manual reader never scans. */
  scan(signal?: { cancelled: boolean }): Promise<TagRead | null>
}

export const manualReader: TagReader = {
  kind: 'manual',
  canScan: false,
  scan: async () => null,
}

/** The reader of this build. Swap for the NFC one once a dev build carries `react-native-nfc-manager`. */
export function tagReader(): TagReader {
  return manualReader
}
