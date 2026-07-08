// ========== FORM UCAPAN ==========
(function() {
  const form = document.getElementById('wishForm');
  const wishList = document.getElementById('wishList');

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();

      // Ambil nilai dari input
      const name = document.getElementById('inputName').value.trim();
      const message = document.getElementById('inputMessage').value.trim();
      const attendance = document.getElementById('inputAttendance').value;

      // Validasi
      if (!name || !message) {
        alert('Mohon isi Nama dan Ucapan terlebih dahulu!');
        return;
      }

      // Buat waktu sekarang
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timestamp = hours + ':' + minutes + ' wib';

      // Buat elemen bubble baru
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = `
        <div class="txt">
          <p class="name">${escapeHTML(name)} ${attendance ? '• ' + attendance : ''}</p>
          <p class="message">${escapeHTML(message)}</p>
          <span class="timestamp">${timestamp}</span>
        </div>
        <div class="bubble-arrow"></div>
      `;

      // Tambahkan ke wishList (di posisi paling atas)
      wishList.insertBefore(bubble, wishList.firstChild);

      // Reset form
      form.reset();

      // Efek scroll ke ucapan baru
      bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Fungsi untuk menghindari XSS
  function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();