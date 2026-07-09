const artists = [
  'Sunidhi Chauhan', 'Javed Ali', 'Mohit Chauhan', 'Shaan', 'Kailash Kher',
  'Armaan Malik', 'Jubin Nautiyal', 'Guru Randhawa', 'Harrdy Sandhu',
  'Mika Singh', 'Daler Mehndi', 'Pritam', 'Vishal-Shekhar', 'Shankar Mahadevan',
  'Hariharan', 'K. S. Chithra', 'S. P. Balasubrahmanyam', 'Anu Malik', 'Bappi Lahiri',
  'Ammy Virk', 'Garry Sandhu', 'Sidhu Moose Wala', 'Karan Aujla', 'Parmish Verma',
  'Jass Manak', 'Mankirt Aulakh', 'Gippy Grewal', 'Fazilpuria', 'Renuka Panwar',
  'Taylor Swift', 'Ed Sheeran', 'Justin Bieber', 'The Weeknd', 'Dua Lipa',
  'Ariana Grande', 'Billie Eilish', 'Post Malone', 'Drake', 'Eminem'
];

async function run() {
  const result = [];
  for (const name of artists) {
    try {
      const res = await fetch(`https://jiosaavn-api-9pw6.onrender.com/api/search/artists?query=${encodeURIComponent(name)}&limit=1`);
      const json = await res.json();
      const artist = json?.data?.results?.[0] || json?.data?.[0] || json?.results?.[0];
      
      let image = '';
      if (artist?.image) {
        if (Array.isArray(artist.image)) {
          image = artist.image.find(i => i.quality === '500x500')?.url || artist.image[artist.image.length-1].url;
        } else {
          image = artist.image;
        }
      }
      
      result.push({ label: name, image: image || '' });
    } catch (e) {
      result.push({ label: name, image: '' });
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(JSON.stringify(result, null, 2));
}

run();
