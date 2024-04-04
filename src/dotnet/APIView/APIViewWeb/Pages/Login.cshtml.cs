using System.Net.NetworkInformation;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using APIViewWeb.Helpers;
using APIViewWeb.Managers;

namespace APIViewWeb.Pages
{
    public class LoginModel : PageModel
    {
        [BindProperty(SupportsGet = true, Name = "returnurl")]
        public string ReturnUrl { get; set; } = "/";

        private readonly IUserProfileManager _userProfileManager;

        public LoginModel(IUserProfileManager userProfileManager)
        {
            _userProfileManager = userProfileManager;
        }

        public async Task<IActionResult> OnGetAsync()
        {
            if (User.Identity.IsAuthenticated)
            {
                var userEmail = PageModelHelpers.GetUserEmail(User);
                var languages = new HashSet<string>(); // Replace with the actual languages
                var preferences = new UserPreferenceModel(); // Replace with the actual preferences
                await _userProfileManager.UpdateUserProfile(User, userEmail, languages, preferences);
                return Redirect(ReturnUrl);
            }

            return Page();
        }
    }
}
