export interface GoogleDocUploadResult {
  fileId: string
  url: string
}

export async function uploadDocxAsGoogleDoc(
  blob: Blob,
  title: string,
  accessToken: string
): Promise<GoogleDocUploadResult> {
  const boundary = `-------sindecon_gdocs_${Date.now()}`
  const openingDelimiter = `--${boundary}\r\n`
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document', // Indicación para que Google Drive lo convierta a Doc nativo
  }

  const metadataPart =
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n`

  const mediaHeader =
    `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`

  const docxBytes = new Uint8Array(await blob.arrayBuffer())

  // Armar el payload multipart combinando metadatos y binario
  const encoder = new TextEncoder()
  const part1 = encoder.encode(openingDelimiter + metadataPart + delimiter + mediaHeader)
  const part3 = encoder.encode(closeDelimiter)

  const fullPayload = new Uint8Array(part1.length + docxBytes.length + part3.length)
  fullPayload.set(part1, 0)
  fullPayload.set(docxBytes, part1.length)
  fullPayload.set(part3, part1.length + docxBytes.length)

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Error de Google Drive (${response.status}): ${errorText || response.statusText}`)
  }

  const data = (await response.json()) as { id: string }
  const fileId = data.id

  return {
    fileId,
    url: `https://docs.google.com/document/d/${fileId}/edit`,
  }
}
