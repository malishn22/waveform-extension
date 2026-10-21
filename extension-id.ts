// Shared by the manifest and the helper's installer. EXTENSION_ID is derived from
// EXTENSION_KEY (sha256 of the DER public key, first 32 hex digits mapped 0-f -> a-p).
// Changing the key changes the ID, and every PC must re-run `waveform-helper install`.
export const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs2O4WCbDS/F9HY2NI+qa0xM2GTayeSoJ6cwRoiMy1eHtEYWmXR5PeP8YkZtgsblpyOsDJCu94IpP93q+PFBVjoAP42DhXjfIP5ajgDuB5rE6vZyUorWHmGsUtesMTlK8ArK0INOXKAFwQ/ZPFZ7YVjNpksWnr2eHa3lBxYFmFsW1hQ6hz4JIEHBQwqcuK7NPe8X9g3s90QKIdjcxIj8LmE38pgvvwanDgADN5+6NvLr0Ybt+z40Dq4zDFN7C4ydfHag191B7NAuXIz7CUtaQrz1vTmL0EYB5F2UlD4XxrwT0BRinzQ/P1p9hN6VllIMqIqcM79TAZSw0VNT5ocPP4QIDAQAB'

export const EXTENSION_ID = 'nigoikhekllkmlfapmgceinpamlnaigk'

export const HOST_NAME = 'com.waveform.presence'
