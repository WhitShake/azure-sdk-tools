using APIViewWeb.Helpers;
using APIViewWeb.LeanModels;
using APIViewWeb.Managers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace APIViewWeb.LeanControllers
{
    public class CommentsController : BaseApiController
    {
        private readonly ILogger<CommentsController> _logger;
        private readonly ICommentsManager _commentsManager;
        private readonly IReviewManager _reviewManager;
        private readonly INotificationManager _notificationManager;

        public CommentsController(ILogger<CommentsController> logger,
            ICommentsManager commentManager, IReviewManager reviewManager, INotificationManager notificationManager)
        {
            _logger = logger;
            _commentsManager = commentManager;
            _reviewManager = reviewManager;
            _notificationManager = notificationManager;
        }

        /// <summary>
        /// Retrieve comments for a review.
        /// </summary>
        /// <param name="reviewId"></param>
        /// <returns></returns>
        [HttpGet("{reviewId}", Name = "GetComments")]
        public async Task<ActionResult<IEnumerable<CommentItemModel>>> GetCommentsAsync(string reviewId)
        {
            var comments = await _commentsManager.GetCommentsAsync(reviewId);
            return new LeanJsonResult(comments, StatusCodes.Status200OK);
        }

        /// <summary>
        /// Create a new Comment
        /// </summary>
        /// <param name="reviewId"></param>
        /// <param name="apiRevisionId"></param>
        /// <param name="elementId"></param>
        /// <param name="commentText"></param>
        /// <param name="commentType"></param>
        /// <param name="resolutionLocked"></param>
        /// <returns></returns>
        [HttpPost(Name = "CreateComment")]
        public async Task<ActionResult> CreateCommentAsync(
            string reviewId, string apiRevisionId, string elementId, string commentText, CommentType commentType, bool resolutionLocked = false)
        {
            if (string.IsNullOrEmpty(commentText))
            {
                return new BadRequestResult();
            }

            var comment = new CommentItemModel
            {
                ReviewId = reviewId,
                APIRevisionId = apiRevisionId,
                ElementId = elementId,
                CommentText = commentText,
                ResolutionLocked = resolutionLocked,
                CreatedBy = User.GetGitHubLogin(),
                CreatedOn = DateTime.UtcNow,
                CommentType = commentType
            };

            await _commentsManager.AddCommentAsync(User, comment);
            var review = await _reviewManager.GetReviewAsync(User, reviewId);
            if (review != null)
            {
                await _notificationManager.SubscribeAsync(review, User);
            }
            return CreatedAtAction("GetComments", new { reviewId = reviewId }, comment);
        }

        /// <summary>
        /// Create a new Comment
        /// </summary>
        /// <param name="reviewId"></param>
        /// <param name="commentId"></param>
        /// <param name="commentText"></param>
        /// <returns></returns>
        [HttpPatch("{reviewId}/{commentId}/updateCommentText", Name = "UpdateCommentText")]
        public async Task<ActionResult> UpdateCommentTextAsync(string reviewId, string commentId, string commentText)
        {
            await _commentsManager.UpdateCommentAsync(User, reviewId, commentId, commentText, new string[0]);
            return Ok();
        }

        /// <summary>
        /// Resolve comments in a comment thread
        /// </summary>
        /// <param name="reviewId"></param>
        /// <param name="elementId"></param>
        /// <returns></returns>
        [HttpPatch("{reviewId}/resolveComments", Name = "ResolveComments")]
        public async Task<ActionResult> ResolveCommentsAsync(string reviewId, string elementId)
        {
            await _commentsManager.ResolveConversation(User, reviewId, elementId);
            return Ok();
        }

        /// <summary>
        /// Resolve comments in a comment thread
        /// </summary>
        /// <param name="reviewId"></param>
        /// <param name="elementId"></param>
        /// <returns></returns>
        [HttpPatch("{reviewId}/unResolveComments", Name = "UnResolveComments")]
        public async Task<ActionResult> UnResolveCommentsAsync(string reviewId, string elementId)
        {
            await _commentsManager.UnresolveConversation(User, reviewId, elementId);
            return Ok();
        }

        /// <summary>
        /// Resolve comments in a comment thread
        /// </summary>
        /// <param name="reviewId"></param>
        /// <param name="commentId"></param>
        /// <returns></returns>
        [HttpPatch("{reviewId}/{commentId}/toggleCommentUpVote", Name = "ToggleCommentUpVote")]
        public async Task<ActionResult> ToggleCommentUpVoteAsync(string reviewId, string commentId)
        {
            await _commentsManager.ToggleUpvoteAsync(User, reviewId, commentId);
            return Ok();
        }

        /// <summary>
        /// Soft Delete a Comment
        /// </summary>
        /// <param name="reviewId"></param>
        /// <param name="commentId"></param>
        /// <param name="elementId"></param>
        /// <returns></returns>
        [HttpDelete("{reviewId}/{commentId}", Name = "DeleteComments")]
        public async Task<ActionResult> DeleteCommentsAsync(string reviewId, string commentId, string elementId)
        {
            await _commentsManager.SoftDeleteCommentAsync(User, reviewId, commentId);
            return Ok();
        }
    }
}
