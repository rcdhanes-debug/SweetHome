async function test() {
  try {
    const res1 = await fetch('http://localhost:5000/api/photos');
    console.log('/api/photos status:', res1.status);
    const data1 = await res1.json();
    console.log('/api/photos count:', data1.length);

    const res2 = await fetch('http://localhost:5000/api/photos/folders');
    console.log('/api/photos/folders status:', res2.status);
    const data2 = await res2.json();
    console.log('/api/photos/folders:', data2);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
