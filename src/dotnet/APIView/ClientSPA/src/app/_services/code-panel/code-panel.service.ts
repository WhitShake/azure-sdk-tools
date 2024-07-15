import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CodePanelService {
  private codeLineSource = new BehaviorSubject<string | null>(null);
  currentCodeLine = this.codeLineSource.asObservable();

  constructor() { }

  updateCodeLine(codeLine: string) {
    this.codeLineSource.next(codeLine);
  }
}