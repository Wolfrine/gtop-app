import { AfterViewInit, Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { Auth } from '@angular/fire/auth';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

@Component({
    selector: 'app-auth-panel',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatTabsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './auth-panel.component.html',
    styleUrl: './auth-panel.component.scss'
})
export class AuthPanelComponent implements AfterViewInit {
    @ViewChild('recaptchaContainer') recaptchaContainer?: ElementRef<HTMLDivElement>;

    authMode: 'login' | 'register' = 'login';
    selectedTabIndex = 0;
    phoneStep: 'request' | 'verify' = 'request';

    emailForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        displayName: ['']
    });

    phoneForm = this.fb.group({
        phone: ['', [Validators.required]],
        displayName: [''],
        otp: ['']
    });

    instantForm = this.fb.group({
        guestName: ['']
    });

    isLoadingEmail = false;
    isSendingPhoneCode = false;
    isVerifyingPhone = false;
    isLoadingGoogle = false;
    isLoadingGuest = false;
    errorMessage = '';

    private confirmationResult?: ConfirmationResult;
    private recaptchaVerifier?: RecaptchaVerifier;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        @Inject(Auth) private firebaseAuth: Auth,
        private snackBar: MatSnackBar
    ) { }

    ngAfterViewInit(): void {
        // Recaptcha is initialised lazily when the user requests an OTP.
    }

    toggleAuthMode(mode: 'login' | 'register') {
        if (this.authMode !== mode) {
            this.authMode = mode;
            this.errorMessage = '';
        }
    }

    onTabChange(index: number) {
        this.selectedTabIndex = index;
        this.errorMessage = '';
        if (index !== 1) {
            this.resetPhoneFlow(false);
        }
    }

    async handleEmailSubmit() {
        this.errorMessage = '';
        if (this.emailForm.invalid) {
            this.emailForm.markAllAsTouched();
            return;
        }

        const { email, password, displayName } = this.emailForm.value;
        if (!email || !password) {
            return;
        }

        this.isLoadingEmail = true;
        try {
            if (this.authMode === 'register') {
                await this.authService.registerWithEmail(email, password, displayName || '');
                this.showToast('Account created! Let’s set up your profile.');
            } else {
                await this.authService.signInWithEmail(email, password);
            }
        } catch (error) {
            this.errorMessage = this.mapError(error);
        } finally {
            this.isLoadingEmail = false;
        }
    }

    async sendPasswordReset() {
        this.errorMessage = '';
        const email = this.emailForm.get('email')?.value;
        if (!email) {
            this.errorMessage = 'Enter your email to receive a reset link.';
            return;
        }

        try {
            await this.authService.sendPasswordReset(email);
            this.showToast('Password reset link sent to your email.');
        } catch (error) {
            this.errorMessage = this.mapError(error);
        }
    }

    async sendPhoneCode() {
        this.errorMessage = '';
        if (!this.phoneForm.get('phone')?.value) {
            this.phoneForm.markAllAsTouched();
            return;
        }

        const phoneNumber = this.normalisePhoneNumber(this.phoneForm.get('phone')?.value ?? '');
        if (!phoneNumber.startsWith('+') || phoneNumber.length < 10) {
            this.errorMessage = 'Include your country code (e.g. +91XXXXXXXXXX).';
            return;
        }

        this.isSendingPhoneCode = true;
        try {
            const verifier = await this.ensureRecaptcha();
            this.confirmationResult = await this.authService.startPhoneSignIn(phoneNumber, verifier);
            this.phoneStep = 'verify';
            this.phoneForm.get('otp')?.setValidators([Validators.required, Validators.minLength(4)]);
            this.phoneForm.get('otp')?.updateValueAndValidity();
            this.showToast('OTP sent. Please check your phone.');
        } catch (error) {
            this.errorMessage = this.mapError(error);
            this.resetRecaptcha();
        } finally {
            this.isSendingPhoneCode = false;
        }
    }

    async verifyPhoneCode() {
        this.errorMessage = '';
        if (!this.confirmationResult) {
            this.errorMessage = 'Request an OTP before verifying.';
            return;
        }

        const otp = (this.phoneForm.get('otp')?.value || '').trim();
        if (!otp) {
            this.phoneForm.get('otp')?.markAsTouched();
            return;
        }

        this.isVerifyingPhone = true;
        try {
            const displayName = this.phoneForm.get('displayName')?.value || '';
            await this.authService.confirmPhoneSignIn(this.confirmationResult, otp, { displayName });
        } catch (error) {
            this.errorMessage = this.mapError(error);
        } finally {
            this.isVerifyingPhone = false;
        }
    }

    resetPhoneFlow(clearMessage: boolean = true) {
        this.phoneStep = 'request';
        this.confirmationResult = undefined;
        this.phoneForm.get('otp')?.clearValidators();
        this.phoneForm.get('otp')?.updateValueAndValidity();
        this.phoneForm.get('otp')?.reset();
        this.resetRecaptcha();
        if (clearMessage) {
            this.errorMessage = '';
        }
    }

    async continueWithGoogle() {
        this.errorMessage = '';
        this.isLoadingGoogle = true;
        try {
            await this.authService.signInWithGoogle();
        } catch (error) {
            this.errorMessage = this.mapError(error);
        } finally {
            this.isLoadingGoogle = false;
        }
    }

    async continueAsGuest() {
        this.errorMessage = '';
        this.isLoadingGuest = true;
        try {
            const name = this.instantForm.get('guestName')?.value || '';
            await this.authService.continueAsGuest(name);
        } catch (error) {
            this.errorMessage = this.mapError(error);
        } finally {
            this.isLoadingGuest = false;
        }
    }

    private async ensureRecaptcha(): Promise<RecaptchaVerifier> {
        if (this.recaptchaVerifier) {
            return this.recaptchaVerifier;
        }

        const container = this.recaptchaContainer?.nativeElement || undefined;
        this.recaptchaVerifier = new RecaptchaVerifier(this.firebaseAuth, container as any || 'recaptcha-container', {
            size: 'invisible'
        });
        await this.recaptchaVerifier.render();
        return this.recaptchaVerifier;
    }

    private resetRecaptcha() {
        if (this.recaptchaVerifier) {
            this.recaptchaVerifier.clear();
            this.recaptchaVerifier = undefined;
        }
    }

    private showToast(message: string) {
        this.snackBar.open(message, undefined, { duration: 4000 });
    }

    private mapError(error: any): string {
        const code: string = error?.code || '';
        switch (code) {
            case 'auth/email-already-in-use':
                return 'An account already exists with this email.';
            case 'auth/invalid-email':
                return 'That email address looks incorrect.';
            case 'auth/wrong-password':
                return 'Incorrect password. Try again or reset it.';
            case 'auth/user-not-found':
                return 'No account found for that email address.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please wait a moment and try again.';
            case 'auth/invalid-verification-code':
            case 'auth/missing-verification-code':
                return 'The OTP you entered is not correct. Please try again.';
            case 'auth/invalid-phone-number':
            case 'auth/missing-phone-number':
                return 'Please enter a valid phone number with country code.';
            default:
                return error?.message || 'Something went wrong. Please try again.';
        }
    }

    private normalisePhoneNumber(raw: string): string {
        const trimmed = (raw || '').replace(/[-\s]/g, '');
        if (trimmed.startsWith('+')) {
            return trimmed;
        }

        if (trimmed.length === 10) {
            return `+91${trimmed}`;
        }
        return trimmed;
    }
}
