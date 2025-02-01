module.exports = async function () {
  try {
    const response = await fetch('/api/randomNumber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error('Network response was not ok ' + response.statusText)
    }

    const responseData = await response.json()
    return responseData
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error)
  }
}
