import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { DashboardComponent } from "./dashboard/dashboard.component";
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from "@angular/common/http";

@NgModule({
  declarations: [AppComponent, DashboardComponent],
  bootstrap: [AppComponent],
  imports: [BrowserModule],
  providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())],
})
export class AppModule {}
