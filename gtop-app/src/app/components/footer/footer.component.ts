import { Component } from '@angular/core';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss'
})
export class FooterComponent {


    hardRefresh() {
        // Unregister Service Worker
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }

            // Clear caches
            if ('caches' in window) {
                caches.keys().then(names => {
                    for (let name of names) caches.delete(name);
                });
            }

            // Clear LocalStorage
            localStorage.clear();

            // Reload page after small delay to ensure everything is cleared
            setTimeout(() => {
                location.reload();
            }, 500);
        });
    }


}
