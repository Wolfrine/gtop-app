import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LearningLabService } from './learning-lab.service';
@Component({
  selector: 'app-learning-lab',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `<main class="learning-lab">
    <section class="lesson-heading">
      <div>
        <p class="eyebrow">GROWTH TUTORIALS · LEARN BY DOING</p>
        <h1>Learning Lab<span>.</span></h1>
        <p class="lede">Make a prediction. Try it. Build an explanation.</p>
      </div>
    </section>
    <nav class="module-tabs" aria-label="Learning Lab">
      <a routerLink="/learning-lab" aria-current="page">Lessons</a
      ><a *ngIf="admin" routerLink="/learning-lab/results"
        >Results & Feedback</a
      >
    </nav>
    <article class="lesson-card">
      <div class="plant-catalog-art" aria-hidden="true"><b>A flower.<br>A new beginning.</b><small>PLANT REPRODUCTION</small></div>
      <div class="lesson-card-copy"><p class="eyebrow teal">FOUNDATION BIOLOGY · ABOUT 20 MINUTES</p><h2>Plant Reproduction</h2><p>Open a flower, deliver pollen, follow fertilisation, and grow a plant without seeds. Five explorations that connect the whole story.</p><ul><li>Interactive flower cutaway and development sequence</li><li>Pollination trials and a two-pot comparison</li><li>Five questions, your field notebook and saved feedback</li></ul><a class="primary-button" routerLink="/learning-lab/plants">Open Plant Reproduction →</a><p class="privacy-note">Open to every signed-in learner. Save your latest five attempts or try without saving.</p></div>
    </article>
    <article class="lesson-card">
      <div class="lesson-art" aria-hidden="true">
        <span>V</span><b>=</b><span>I</span><b>×</b><span>R</span
        ><small>CHANGE THE CIRCUIT. SEE THE RELATIONSHIP.</small>
      </div>
      <div class="lesson-card-copy">
        <p class="eyebrow teal">CLASS 10 · PHYSICS · ABOUT 15 MINUTES</p>
        <h2>Current Lab — Electricity</h2>
        <p>
          Discover how voltage, resistance and parallel paths change current.
          Predict first, explore three circuits, then check your understanding.
        </p>
        <ul>
          <li>3 guided experiments with a live circuit</li>
          <li>5 questions with explanations</li>
          <li>Saved progress and feedback for GTOP admins</li>
        </ul>
        <a class="primary-button" routerLink="/learning-lab/current"
          >Open Current Lab →</a
        >
        <p class="privacy-note">
          Open to every signed-in GTOP user, regardless of grade. Your latest
          five attempts are saved to your account. You can also practise without
          saving.
        </p>
      </div>
    </article>
  </main>`,
})
export class LearningLabComponent implements OnInit {
  admin = false;
  constructor(private labs: LearningLabService) {}
  async ngOnInit() {
    try {
      this.admin = await this.labs.isAdmin();
    } catch {
      this.admin = false;
    }
  }
}
