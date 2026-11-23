import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { adminGroups } from '../../pages/admin-dashboard/admin-groups';

@Component({
    selector: 'app-side-nav',
    standalone: true,
    templateUrl: './side-nav.component.html',
    styleUrl: './side-nav.component.scss',
    imports: [MatIconModule, RouterLink, RouterLinkActive],
})
export class SideNavComponent {
    @Input() section = '';
    @Input() admin = false;

    readonly adminSections = [{ key: '', title: 'Overview', icon: 'space_dashboard' }, ...adminGroups];

    readonly destinations = [
        { label: 'Practice', icon: 'menu_book', route: '/dashboard' },
        { label: 'Answer Sheets', shortLabel: 'Sheets', icon: 'description', route: '/answer-sheets' },
        { label: 'Progress', icon: 'insights', route: '/reports' },
        { label: 'Admin', icon: 'space_dashboard', route: '/admin', staff: true },
    ];
}
