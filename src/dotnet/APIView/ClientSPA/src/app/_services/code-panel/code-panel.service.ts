import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CodePanelRowData } from 'src/app/_models/revision';

@Injectable({
  providedIn: 'root'
})
export class CodePanelService {
  private codeLineSource = new BehaviorSubject<string | null>(null);
  currentCodeLine = this.codeLineSource.asObservable();

  private codePanelRowData: CodePanelRowData[] = [];

  updateCodeLine(codeLine: string) {
    this.codeLineSource.next(codeLine);
  }

  setCodePanelRowData(data: CodePanelRowData[]) {
    this.codePanelRowData = data;
  }

  getCodeLineContent(nodeIdHashed: string): string {
    const codeLine = this.codePanelRowData.find(row => row.nodeIdHashed === nodeIdHashed);
    return codeLine && codeLine.rowOfTokens ? codeLine.rowOfTokens.map(token => token.value).join('') : 'No content found';
  }
}