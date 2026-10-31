// Hands a file to the browser through a temporary link. Whether the browser
// actually saves it is not observable: an iframe whose sandbox lacks
// `allow-downloads` drops the click silently, which is why the export dialog
// keeps the file and offers to try again.
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Long enough for a slow disk prompt, short enough not to hold the file for ever.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
