import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => {
    console.error(err);
    const root = document.querySelector('app-root');
    if (!root) return;
    const message = document.createElement('main');
    message.style.cssText = 'max-width:640px;margin:12vh auto;padding:24px;font:18px/1.6 system-ui';
    const heading = document.createElement('h1');
    heading.textContent = 'GTOP could not start.';
    const detail = document.createElement('p');
    detail.textContent = 'Please check your connection and reload. Your saved work is safe.';
    const reload = document.createElement('button');
    reload.textContent = 'Reload GTOP';
    reload.className = 'btn btn-primary';
    reload.addEventListener('click', () => location.reload());
    message.append(heading, detail, reload);
    root.replaceChildren(message);
  });
