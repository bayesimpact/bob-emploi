const isMobileVersion = window.innerWidth < 800

// On desktop, switch to mobile version if the window is resized or if the page is zoomed a lot.
if (!isMobileVersion) {
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 800) {
      return
    }
    document.location.reload()
  })
}

export default isMobileVersion
