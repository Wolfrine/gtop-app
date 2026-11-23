import { Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';
import { ActiveUsersService } from '../../services/active-users.service';
import { McqService } from '../../services/mcq.service';

import { adminGroups } from './admin-groups';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    templateUrl: './admin-dashboard.component.html',
    styleUrl: './admin-dashboard.component.scss',
    imports: [MatIconModule, RouterLink],
})
export class AdminDashboardComponent implements OnInit {
    readonly presence = inject(ActiveUsersService);
    private readonly mcqs = inject(McqService);
    readonly groups = adminGroups;
    readonly group = toSignal(inject(ActivatedRoute).queryParamMap.pipe(
        map(params => adminGroups.find(item => item.key === params.get('section')) ?? null)
    ));

    totalMCQs: number | null = null;
    countUnavailable = false;

    async ngOnInit(): Promise<void> {
        try {
            this.totalMCQs = await this.mcqs.getTotalMCQCount();
        } catch {
            this.countUnavailable = true;
        }
    }
}
