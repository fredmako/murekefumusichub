<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CommunityController;
use App\Http\Controllers\Api\CompositionController;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\RequestRoleController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get("/health", fn () => response()->json(["ok" => true]));

// Auth compatibility endpoints (legacy)
Route::post("/register", [AuthController::class, "register"]);
Route::post("/login", [AuthController::class, "login"]);
Route::post("/logout", [AuthController::class, "logout"])->middleware("auth.supabase");
Route::post("/sync-user", [AuthController::class, "syncUser"])->middleware("auth.supabase");
Route::get("/me", [AuthController::class, "me"])->middleware("auth.supabase");

// Users / account
Route::get("/users/by-auth-uid/{authUid}", [UserController::class, "byAuthUid"]);
Route::get("/users/{id}", [UserController::class, "show"]);
Route::post("/users/ensure", [UserController::class, "ensure"]);
Route::put("/users/{id}", [UserController::class, "update"])->middleware("auth.supabase");

Route::put("/account", [AccountController::class, "update"])->middleware("auth.supabase");
Route::delete("/account", [AccountController::class, "destroy"])->middleware("auth.supabase");

// Roles / role requests
Route::get("/user/roles/{authUid}", [RoleController::class, "rolesByAuthUid"]);
Route::get("/request-role/status", [RequestRoleController::class, "status"])->middleware("auth.supabase");
Route::get("/request-role/invite-status", [RequestRoleController::class, "inviteStatus"])->middleware("auth.supabase");
Route::post("/request-role/accept-invite", [RequestRoleController::class, "acceptInvite"])->middleware("auth.supabase");
Route::post("/request-role", [RequestRoleController::class, "requestRole"])->middleware("auth.supabase");

// Registration payments
Route::get("/registration/regulations", [RegistrationController::class, "regulations"]);
Route::get("/registration/payments/my", [RegistrationController::class, "myPayments"])->middleware("auth.supabase");
Route::post("/registration/payments/submit", [RegistrationController::class, "submitPayment"])->middleware("auth.supabase");

// Categories
Route::get("/categories", [CategoryController::class, "index"]);
Route::post("/categories", [CategoryController::class, "store"])
    ->middleware(["auth.supabase", "admin.only"]);

// Compositions
Route::post("/compositions/analyze-pdf", [CompositionController::class, "analyzePdf"])
    ->middleware("auth.supabase");
Route::post("/compositions/price-to-usd", [CompositionController::class, "priceToUsd"])
    ->middleware("auth.supabase");
Route::get("/compositions", [CompositionController::class, "index"]);
Route::get("/compositions/composer/{composerId}", [CompositionController::class, "byComposer"]);
Route::get("/compositions/{id}/midi", [CompositionController::class, "midi"]);
Route::get("/compositions/{id}", [CompositionController::class, "show"]);
Route::post("/compositions", [CompositionController::class, "store"])->middleware("auth.supabase");
Route::put("/compositions/{id}", [CompositionController::class, "update"])->middleware("auth.supabase");
Route::delete("/compositions/{id}", [CompositionController::class, "destroy"])->middleware("auth.supabase");

// Upload
Route::post("/upload/{bucket}", [UploadController::class, "upload"])->middleware("auth.supabase");

// Purchases / checkout
Route::get("/purchases", [PurchaseController::class, "index"])->middleware("auth.supabase");
Route::post("/purchases", [PurchaseController::class, "store"])->middleware("auth.supabase");
Route::delete("/purchases/{id}", [PurchaseController::class, "destroy"])->middleware("auth.supabase");
Route::get("/purchases/{id}/download", [PurchaseController::class, "download"])->middleware("auth.supabase");
Route::get("/purchases/recommendations", [PurchaseController::class, "recommendations"])->middleware("auth.supabase");
Route::put("/purchases/preferences", [PurchaseController::class, "updatePreferences"])->middleware("auth.supabase");

Route::get("/checkout/status", [CheckoutController::class, "status"])->middleware("auth.supabase");
Route::post("/checkout/submit", [CheckoutController::class, "submit"])->middleware("auth.supabase");

// Media
Route::get("/media/landing-images", [MediaController::class, "landingImages"]);
Route::get("/media/composition-background", [MediaController::class, "compositionBackground"]);

// Enrollments
Route::post("/enrollments", [EnrollmentController::class, "submit"])->middleware("auth.supabase");
Route::get("/enrollments/my", [EnrollmentController::class, "my"])->middleware("auth.supabase");

// Community
Route::get("/community/rooms/primary", [CommunityController::class, "primaryRoom"])->middleware("auth.supabase");
Route::get("/community/rooms/{roomId}/messages", [CommunityController::class, "roomMessages"])->middleware("auth.supabase");
Route::post("/community/rooms/{roomId}/messages", [CommunityController::class, "sendMessage"])->middleware("auth.supabase");
Route::get("/community/settings/me", [CommunityController::class, "mySettings"])->middleware("auth.supabase");
Route::put("/community/settings/me", [CommunityController::class, "updateMySettings"])->middleware("auth.supabase");

// Notifications
Route::get("/notifications/read", [NotificationController::class, "read"])->middleware("auth.supabase");
Route::post("/notifications/mark-read", [NotificationController::class, "markRead"])->middleware("auth.supabase");

// Support
Route::post("/support/issues", [SupportController::class, "issues"])->middleware("auth.supabase");
Route::get("/support/inbox", [SupportController::class, "inbox"])->middleware("auth.supabase");
Route::post("/support/ai/draft", [SupportController::class, "aiDraft"])->middleware("auth.supabase");
Route::post("/support/threads", [SupportController::class, "createThread"])->middleware("auth.supabase");
Route::get("/support/threads/my", [SupportController::class, "myThreads"])->middleware("auth.supabase");
Route::get("/support/threads/{threadId}/messages", [SupportController::class, "threadMessages"])->middleware("auth.supabase");
Route::post("/support/threads/{threadId}/messages", [SupportController::class, "sendMessage"])->middleware("auth.supabase");
Route::post("/support/threads/{threadId}/read", [SupportController::class, "markRead"])->middleware("auth.supabase");
Route::get("/support/admin/tickets", [SupportController::class, "adminTickets"])
    ->middleware(["auth.supabase", "admin.only"]);
Route::post("/support/admin/tickets/{threadId}/pick", [SupportController::class, "pickTicket"])
    ->middleware(["auth.supabase", "admin.only"]);
Route::post("/support/admin/tickets/{threadId}/reject", [SupportController::class, "rejectTicket"])
    ->middleware(["auth.supabase", "admin.only"]);
Route::get("/support/admin/threads", [SupportController::class, "adminThreads"])
    ->middleware(["auth.supabase", "admin.only"]);
Route::post("/support/admin/threads", [SupportController::class, "createAdminThread"])
    ->middleware(["auth.supabase", "admin.only"]);
Route::post("/support/admin/announcements", [SupportController::class, "createAnnouncement"])
    ->middleware(["auth.supabase", "admin.only"]);
Route::delete("/support/admin/threads/{threadId}", [SupportController::class, "deleteAdminThread"])
    ->middleware(["auth.supabase", "admin.only"]);

// Admin
Route::prefix("admin")->middleware(["auth.supabase", "admin.only"])->group(function () {
    Route::get("/bootstrap", [AdminController::class, "bootstrap"]);
    Route::get("/roles", [AdminController::class, "roles"]);
    Route::get("/users", [AdminController::class, "users"]);
    Route::get("/compositions", [AdminController::class, "compositions"]);
    Route::get("/transactions", [AdminController::class, "transactions"]);
    Route::get("/enrollments", [AdminController::class, "enrollments"]);
    Route::post("/enrollments/{enrollmentId}/admit", [AdminController::class, "admitEnrollment"]);
    Route::get("/invites", [AdminController::class, "invites"]);
    Route::get("/composer-requests", [AdminController::class, "composerRequests"]);
    Route::get("/stats", [AdminController::class, "stats"]);
    Route::get("/debug/compositions", [AdminController::class, "debugCompositions"]);
    Route::post("/invites", [AdminController::class, "createInvite"]);
    Route::delete("/invites/{email}", [AdminController::class, "revokeInvite"]);
    Route::post("/compositions/{compositionId}/verify", [AdminController::class, "verifyComposition"]);
    Route::post("/compositions/{compositionId}/unverify", [AdminController::class, "unverifyComposition"]);
    Route::post("/users/{userId}/promote-composer", [AdminController::class, "promoteComposer"]);
    Route::post("/users/{userId}/demote-composer", [AdminController::class, "demoteComposer"]);
    Route::post("/users/{userId}/promote-admin", [AdminController::class, "promoteAdmin"]);
    Route::post("/users/{userId}/demote-admin", [AdminController::class, "demoteAdmin"]);
    Route::post("/users/{userId}/suspend", [AdminController::class, "suspend"]);
    Route::post("/users/{userId}/unsuspend", [AdminController::class, "unsuspend"]);
    Route::delete("/users/{userId}", [AdminController::class, "deleteUser"]);
    Route::post("/composer-requests/{userId}/reject", [AdminController::class, "rejectComposerRequest"]);
    Route::post("/role-requests/{userId}/reject", [AdminController::class, "rejectRoleRequest"]);
    Route::post("/payment-submissions/{submissionId}/approve", [AdminController::class, "approvePaymentSubmission"]);
    Route::post("/payment-submissions/{submissionId}/reject", [AdminController::class, "rejectPaymentSubmission"]);
    Route::get("/notifications", [AdminController::class, "notifications"]);
    Route::get("/registration/regulations", [AdminController::class, "registrationRegulations"]);
    Route::put("/registration/regulations", [AdminController::class, "updateRegistrationRegulations"]);
    Route::get("/registration/payments", [AdminController::class, "registrationPayments"]);
    Route::post("/registration/payments/{submissionId}/approve", [AdminController::class, "approveRegistrationPayment"]);
    Route::post("/registration/payments/{submissionId}/reject", [AdminController::class, "rejectRegistrationPayment"]);
});

