export function openDocumentPopup(htmlContent) {
  const popup = window.open('', '_blank', 'width=794,height=1123')

  if (!popup) {
    throw new Error('Unable to open document popup')
  }

  popup.document.write(htmlContent)
  popup.document.close()
  popup.focus()
}