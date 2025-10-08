/* eslint-disable */
export const initBookingSuccess = () => {
  const countdownElement = document.getElementById("countdown")
  if (!countdownElement) return

  let seconds = 10

  const countdown = setInterval(() => {
    seconds--
    countdownElement.textContent = seconds

    if (seconds <= 0) {
      clearInterval(countdown)
      window.location.href = "/my-tours"
    }
  }, 1000)
}
