export const data = {
    bride: {
        L: {
            id: 1,
            name: 'Lutfi Abdilah',
            child: 'Putra ke Kedua',
            father: 'Bapak H. Ma.ani (Alm.)',
            mother: 'Ibu Hj. Nur Hidayati',
            image: './src/assets/images/cowo.jpg'
        },
        P: {
            id: 2,
            name: 'Ainul Istiqomah',
            child: 'Putri ke Kedua',
            father: 'H. Sugimin',
            mother: 'Hj. Sadiyem',
            image: './src/assets/images/cewe.jpg'
        },

        couple: './src/assets/images/couple.jpg'
    },

    time: {
        marriage: {
            year: '2025',
            month: 'Oktober',
            date: '25',
            day: 'Kamis',
            hours: {
                start: '08.00',
                finish: 'Selesai'
            }
        },
        reception: {
            year: '2025',
            month: 'Oktober',
            date: '25',
            day: 'Kamis',
            hours: {
                start: '10.00',
                finish: 'Selesai'
            }
        },
        address: 'Blok C Dusun I Embacang Permai Kec Mesuji Raya Kab OKI Sumatera Selatan, 30685'
    },

    link: {
        calendar: 'https://calendar.app.google/uiakt4dCGK9pVhJa6',
        map: 'https://maps.app.goo.gl/b7swNbMGTJRiDKL86',
    },

    galeri: [
        {
            id: 1,
            image: './src/assets/images/1.jpg'
        },
        {
            id: 2,
            image: './src/assets/images/2.jpg'
        },
        {
            id: 3,
            image: './src/assets/images/3.jpg'
        },
        {
            id: 4,
            image: './src/assets/images/4.jpg'
        },
        {
            id: 5,
            image: './src/assets/images/5.jpg'
        }
    ],

    bank: [
        {
            id: 2,
            name: 'Ainul Istiqomah',
            icon: './src/assets/images/bri.png',
            rekening: '208801006873504'
        },
    ],

    audio: './src/assets/audio/wedding.mp3',

    api: 'https://script.google.com/macros/s/AKfycbyxcLZ_poPSj0BSy6bkjg40l9M-uqt_4XkGwoOjNN9TxVhpYpzC1kdL-TKAVGo11NYzpQ/exec',

    navbar: [
        {
            id: 1,
            teks: 'Home',
            icon: 'bx bxs-home-heart',
            path: '#home',
        },
        {
            id: 2,
            teks: 'Mempelai',
            icon: 'bx bxs-group',
            path: '#bride',
        },
        {
            id: 3,
            teks: 'Tanggal',
            icon: 'bx bxs-calendar-check',
            path: '#time',
        },
        {
            id: 4,
            teks: 'Galeri',
            icon: 'bx bxs-photo-album',
            path: '#galeri',
        },
        {
            id: 5,
            teks: 'Ucapan',
            icon: 'bx bxs-message-rounded-dots',
            path: '#wishas',
        },
    ],
}
