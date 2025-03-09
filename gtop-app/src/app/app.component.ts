import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, HeaderComponent, FooterComponent, CommonModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    title = "GTOP - APP"
    isLandingPage = false;
    constructor(private authService: AuthService, private router: Router) {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.isLandingPage = event.url === '/';
            }
        });
    }

    ngOnInit() {
        this.authService.initGoogleOneTap(); // 🔥 Ensure One Tap runs on load
    }



}
