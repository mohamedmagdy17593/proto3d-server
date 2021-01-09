import app from './app';

const PORT = process.env.PORT || 4000;

async function init() {
  app.listen(PORT as number, () => {
    console.log(`app is running on port ${PORT}`);
  });
}

init();
