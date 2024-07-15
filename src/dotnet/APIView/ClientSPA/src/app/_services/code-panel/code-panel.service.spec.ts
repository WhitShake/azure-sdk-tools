import { TestBed } from '@angular/core/testing';

import { CodePanelService } from './code-panel.service';

describe('CodePanelService', () => {
  let service: CodePanelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodePanelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
