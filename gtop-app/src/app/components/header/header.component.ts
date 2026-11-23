import { Component, Input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';

export interface HeaderBackLink {
    label: string;
    path: string;
    queryParams?: Record<string, unknown>;
}

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [AsyncPipe, MatIconModule, MatMenuModule, RouterLink],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss',
})
export class HeaderComponent {
    @Input() section = '';
    @Input() setup = false;
    @Input() mobileBack: HeaderBackLink | null = null;

    private readonly auth = inject(AuthService);
    readonly user$ = this.auth.readyUser$;

    signOut(): void {
        void this.auth.signOut();
    }
}
