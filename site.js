(() => {
  const toggle = document.getElementById('navToggle')
  const links = document.getElementById('navLinks')

  if (!toggle || !links) return

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open')
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation')
  })
})()
