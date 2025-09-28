import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VersionService } from '../../services/version.service';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss'
})
export class FooterComponent {
    version = '1.2.02';
    firestoreVersion = this.versionService.firestoreVersion;

    hideUpdatePrompt = signal<boolean>(sessionStorage.getItem('hideVersionPrompt') === 'true');

    showUpdatePrompt = computed(() => {
        const remote = this.firestoreVersion();
        const show =
            remote &&
            remote !== this.version &&
            !this.hideUpdatePrompt();

        console.log('[Version Check] Local:', this.version, ' | Firestore:', remote, ' | Show Update:', show);
        return show;
    });

    constructor(private versionService: VersionService) { }

    async hardRefresh() {
        console.log('[Hard Refresh] Triggered');

        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));

        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        localStorage.clear();
        location.reload();
    }

    hideForSession() {
        sessionStorage.setItem('hideVersionPrompt', 'true');
        this.hideUpdatePrompt.set(true);
        console.log('[Version Prompt] User chose to hide for session');
    }
}
