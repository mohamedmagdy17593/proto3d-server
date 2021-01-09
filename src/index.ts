import app from './app';

async function init() {
  app.listen(4000, () => {
    console.log('app is running on port 4000');
  });
}

init();
