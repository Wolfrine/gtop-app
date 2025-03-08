import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, FooterComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    title = "GTOP - APP"
    constructor(private authService: AuthService) { }

    ngOnInit() {
        this.authService.initGoogleOneTap(); // 🔥 Ensure One Tap runs on load
    }
}