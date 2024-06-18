import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { MenuItem, TreeNode } from 'primeng/api';
import { Subject, take, takeUntil, tap } from 'rxjs';
import { getLanguageCssSafeName } from 'src/app/_helpers/component-helpers';
import { getQueryParams } from 'src/app/_helpers/router-helpers';
import { UserProfile } from 'src/app/_models/auth_service_models';
import { CommentItemModel, Review } from 'src/app/_models/review';
import { APIRevision, ApiTreeBuilderData, CodePanelData, CodePanelRowData, CodePanelRowDatatype, CodePanelToggleableData, ReviewPageWorkerMessageDirective } from 'src/app/_models/revision';
import { AuthService } from 'src/app/_services/auth/auth.service';
import { ReviewsService } from 'src/app/_services/reviews/reviews.service';
import { RevisionsService } from 'src/app/_services/revisions/revisions.service';
import { UserProfileService } from 'src/app/_services/user-profile/user-profile.service';
import { WorkerService } from 'src/app/_services/worker/worker.service';
import { CodePanelComponent } from '../code-panel/code-panel.component';
import { HandleRedirectDueToExpiredCredentials } from 'src/app/_helpers/service-helpers';
import { ConfigService } from 'src/app/_services/config/config.service';

@Component({
  selector: 'app-review-page',
  templateUrl: './review-page.component.html',
  styleUrls: ['./review-page.component.scss']
})
export class ReviewPageComponent implements OnInit {
  @ViewChild(CodePanelComponent) codePanelComponent!: CodePanelComponent;

  reviewId : string | null = null;
  activeApiRevisionId : string | null = null;
  diffApiRevisionId : string | null = null;
  diffStyle : string | null = null;

  userProfile : UserProfile | undefined;
  review : Review | undefined = undefined;
  apiRevisions: APIRevision[] = [];
  activeAPIRevision : APIRevision | undefined = undefined;
  reviewComments : CommentItemModel[] | undefined = [];
  revisionSidePanel : boolean | undefined = undefined;
  reviewPageNavigation : TreeNode[] = [];
  language: string | undefined;
  languageSafeName: string | undefined;
  navTreeNodeIdHashed : string | undefined;
  showLineNumbers : boolean = true;

  codePanelData: CodePanelData | null = null;
  codePanelRowData: CodePanelRowData[] = [];
  apiRevisionPageSize = 50;
  lastNodeIdUnhashedDiscarded = '';

  private destroy$ = new Subject<void>();
  private destroyLoadAPIRevision$ : Subject<void>  | null = null;
  private destroyApiTreeBuilder$ : Subject<void>  | null = null;

  sideMenu: MenuItem[] | undefined;

  constructor(private route: ActivatedRoute, private router: Router, private apiRevisionsService: RevisionsService,
    private reviewsService: ReviewsService, private workerService: WorkerService, private changeDeterctorRef: ChangeDetectorRef,
    private userProfileService: UserProfileService, private configService: ConfigService) {}

  ngOnInit() {
    this.userProfileService.getUserProfile().subscribe(
      (userProfile : any) => {
        this.userProfile = userProfile;
        console.log('userProfile', userProfile)
        if(this.userProfile?.preferences.hideLineNumbers) {
          this.showLineNumbers = false;
        }
      });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.updateStateBasedOnQueryParams(params);
    });

    this.reviewId = this.route.snapshot.paramMap.get('reviewId');

    this.loadReview(this.reviewId!);
    this.loadAPIRevisions(0, this.apiRevisionPageSize);

    this.sideMenu = [
      {
          icon: 'bi bi-clock-history',
      },
      {
          icon: 'bi bi-file-diff'
      },
      {
          icon: 'bi bi-chat-left-dots'
      }
    ];
  }

  updateStateBasedOnQueryParams(params: Params) {
    this.activeApiRevisionId = params['activeApiRevisionId'];
    this.diffApiRevisionId = params['diffApiRevisionId'];
    this.diffStyle = params['diffStyle'];
    this.reviewPageNavigation = [];
    this.codePanelRowData = [];
    this.codePanelData = null;
    this.changeDeterctorRef.detectChanges();
    this.workerService.startWorker().then(() => {
      this.registerWorkerEventHandler();
      this.loadReviewContent(this.reviewId!, this.activeApiRevisionId, this.diffApiRevisionId);
    });
  }

  registerWorkerEventHandler() {
    // Ensure existing subscription is destroyed
    this.destroyApiTreeBuilder$?.next();
    this.destroyApiTreeBuilder$?.complete();
    this.destroyApiTreeBuilder$ = new Subject<void>();

    this.workerService.onMessageFromApiTreeBuilder().pipe(takeUntil(this.destroyApiTreeBuilder$)).subscribe(data => {
      if (data.directive === ReviewPageWorkerMessageDirective.CreatePageNavigation) {
        this.reviewPageNavigation = data.payload as TreeNode[];
      }

      if (data.directive === ReviewPageWorkerMessageDirective.UpdateCodePanelRowData) {
        this.codePanelRowData = data.payload as CodePanelRowData[];
      }

      if (data.directive === ReviewPageWorkerMessageDirective.UpdateCodePanelData) {
        this.codePanelData = data.payload as CodePanelData;
        this.workerService.terminateWorker();
      }
    });
  }

  loadReviewContent(reviewId: string, activeApiRevisionId: string | null = null, diffApiRevisionId: string | null = null) {
    this.reviewsService.getReviewContent(reviewId, activeApiRevisionId, diffApiRevisionId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: ArrayBuffer) => {
          const apiTreeBuilderData : ApiTreeBuilderData = {
            diffStyle: this.diffStyle!,
            showDocumentation: this.userProfile?.preferences.showDocumentation!
          };
          // Passing ArrayBufer to worker is way faster than passing object
          this.workerService.postToApiTreeBuilder(response, apiTreeBuilderData);
        },
        error: (error: any) => {
          HandleRedirectDueToExpiredCredentials(error, this.configService);
        }
      });
  }

  loadReview(reviewId: string) {
    this.reviewsService.getReview(reviewId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (review: Review) => {
          this.review = review;
        },
        error: (error: any) => {
          HandleRedirectDueToExpiredCredentials(error, this.configService);
        }
      });
  }

  loadAPIRevisions(noOfItemsRead : number, pageSize: number) {
    // Ensure existing subscription is destroyed
    this.destroyLoadAPIRevision$?.next();
    this.destroyLoadAPIRevision$?.complete();
    this.destroyLoadAPIRevision$ = new Subject<void>();

    this.apiRevisionsService.getAPIRevisions(noOfItemsRead, pageSize, this.reviewId!, undefined, undefined, 
      undefined, "createdOn", undefined, undefined, undefined, true)
      .pipe(takeUntil(this.destroyLoadAPIRevision$)).subscribe({
        next: (response: any) => {
          this.apiRevisions = response.result;
          if (this.apiRevisions.length > 0) {
            this.language = this.apiRevisions[0].language;
            this.languageSafeName = getLanguageCssSafeName(this.language);
            this.activeAPIRevision = this.apiRevisions.filter(x => x.id === this.activeApiRevisionId)[0];
          }
        },
        error: (error: any) => {
          HandleRedirectDueToExpiredCredentials(error, this.configService);
        }
      });
  }

  showRevisionsPanel(showRevisionsPanel : any){
    this.revisionSidePanel = showRevisionsPanel as boolean;
  }

  handleDiffStyleEmitter(state: string) {
    let newQueryParams = getQueryParams(this.route);
    newQueryParams['diffStyle'] = state;
    this.router.navigate([], { queryParams: newQueryParams });
  }

  handleShowCommentsEmitter(state: boolean) {
    let userPreferenceModel = this.userProfile?.preferences;
    userPreferenceModel!.showComments = state;
    this.userProfileService.updateUserPrefernece(userPreferenceModel!).pipe(takeUntil(this.destroy$)).subscribe();
    if (userPreferenceModel!.showComments) {
      this.codePanelComponent?.insertRowTypeIntoScroller(CodePanelRowDatatype.CommentThread);
    }
    else {
      this.codePanelComponent?.removeRowTypeFromScroller(CodePanelRowDatatype.CommentThread);
    }
  }

  handleShowSystemCommentsEmitter(state: boolean) {
    let userPreferenceModel = this.userProfile?.preferences;
    userPreferenceModel!.showSystemComments = state;
    this.userProfileService.updateUserPrefernece(userPreferenceModel!).pipe(takeUntil(this.destroy$)).subscribe();
    if (userPreferenceModel!.showSystemComments) {
      this.codePanelComponent?.insertRowTypeIntoScroller(CodePanelRowDatatype.Diagnostics);
    }
    else {
      this.codePanelComponent?.removeRowTypeFromScroller(CodePanelRowDatatype.Diagnostics);
    }
  }

  handleShowDocumentationEmitter(state: boolean) {
    let userPreferenceModel = this.userProfile?.preferences;
    userPreferenceModel!.showDocumentation = state;
    this.userProfileService.updateUserPrefernece(userPreferenceModel!).pipe(takeUntil(this.destroy$)).subscribe();
    if (userPreferenceModel!.showDocumentation) {
      this.codePanelComponent?.insertRowTypeIntoScroller(CodePanelRowDatatype.Documentation);
    }
    else {
      this.codePanelComponent?.removeRowTypeFromScroller(CodePanelRowDatatype.Documentation);
    }
  }

  handleShowLineNumbersEmitter(state: boolean) {
    let userPreferenceModel = this.userProfile?.preferences;
    userPreferenceModel!.hideLineNumbers = !state;
    this.userProfileService.updateUserPrefernece(userPreferenceModel!).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showLineNumbers = userPreferenceModel!.hideLineNumbers;
    });
    }

  handleNavTreeNodeEmmitter(nodeIdHashed: string) {
    this.navTreeNodeIdHashed = nodeIdHashed;
  }

  handleMarkAsViewedEmitter(state: boolean) {
    this.apiRevisionsService.toggleAPIRevisionViewedByForUser(this.activeApiRevisionId!, state).pipe(take(1)).subscribe();
  }

  ngOnDestroy() {
    this.workerService.terminateWorker();
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyLoadAPIRevision$?.next();
    this.destroyLoadAPIRevision$?.complete();
    this.destroyApiTreeBuilder$?.next();
    this.destroyApiTreeBuilder$?.complete();
  }
}
