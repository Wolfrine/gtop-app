import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => {
    console.error(err);
    const root = document.querySelector('app-root');
    if (root) root.innerHTML = '<main style="max-width:40rem;margin:15vh auto;padding:2rem;font-family:system-ui;color:#172b4d"><h1>GTOP could not start</h1><p>Please reload the page to try again.</p><button onclick="location.reload()" style="padding:12px 20px">Reload GTOP</button> <a href="/">Return home</a></main>';
  });
