<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class RegistrationPaymentService
{
    public const TYPE_ENROLLMENT = "enrollment";
    public const TYPE_COMPOSER_REQUEST = "composer_request";

    private const DEFAULT_REGULATIONS = [
        "enrollment_fee" => 0,
        "composer_request_fee" => 0,
        "bank_name" => "I&M Bank",
        "bank_account_number" => "0030 7335 5161 50",
        "account_name" => "Murekefu Music Hub",
        "controlling_admin_identifier" => "fredrickmakori102",
        "is_active" => true,
    ];

    public function normalizeRegistrationType(mixed $rawType): ?string
    {
        $value = strtolower(trim((string) ($rawType ?? "")));
        if ($value === self::TYPE_ENROLLMENT) {
            return self::TYPE_ENROLLMENT;
        }
        if ($value === self::TYPE_COMPOSER_REQUEST || $value === "composer" || $value === "composer-request") {
            return self::TYPE_COMPOSER_REQUEST;
        }

        return null;
    }

    public function normalizePaymentRef(mixed $rawValue): string
    {
        return preg_replace('/\s+/', '', strtoupper(trim((string) ($rawValue ?? "")))) ?: "";
    }

    public function isValidPaymentRef(mixed $paymentRef): bool
    {
        return preg_match('/^[A-Z0-9\-]{6,96}$/', (string) ($paymentRef ?? "")) === 1;
    }

    public function defaultControllingAdminIdentifier(): string
    {
        return (string) self::DEFAULT_REGULATIONS["controlling_admin_identifier"];
    }

    public function formatPublicRegulations(array $regulations): array
    {
        return [
            "enrollmentFee" => (float) ($regulations["enrollment_fee"] ?? 0),
            "composerRequestFee" => (float) ($regulations["composer_request_fee"] ?? 0),
            "bankName" => $regulations["bank_name"] ?? "I&M Bank",
            "bankAccountNumber" => $regulations["bank_account_number"] ?? "0030 7335 5161 50",
            "accountName" => $regulations["account_name"] ?? "Murekefu Music Hub",
            "controllingAdminIdentifier" => $regulations["controlling_admin_identifier"] ?? $this->defaultControllingAdminIdentifier(),
            "updatedAt" => $regulations["updated_at"] ?? null,
        ];
    }

    public function getRequiredRegistrationFee(array $regulations, string $registrationType): float
    {
        if ($registrationType === self::TYPE_ENROLLMENT) {
            return (float) ($regulations["enrollment_fee"] ?? 0);
        }
        if ($registrationType === self::TYPE_COMPOSER_REQUEST) {
            return (float) ($regulations["composer_request_fee"] ?? 0);
        }

        return 0.0;
    }

    public function ensureActiveRegistrationRegulations(): array
    {
        $activeRow = DB::table("registration_regulations")
            ->where("is_active", true)
            ->orderByDesc("updated_at")
            ->first();

        if ($activeRow) {
            return [
                ...self::DEFAULT_REGULATIONS,
                ...(array) $activeRow,
            ];
        }

        DB::table("registration_regulations")->insert(self::DEFAULT_REGULATIONS);

        $createdRow = DB::table("registration_regulations")
            ->where("is_active", true)
            ->orderByDesc("updated_at")
            ->first();

        if ($createdRow) {
            return [
                ...self::DEFAULT_REGULATIONS,
                ...(array) $createdRow,
            ];
        }

        return self::DEFAULT_REGULATIONS;
    }

    public function findApprovedUnconsumedRegistrationPayment(string $requesterId, string $registrationType): ?array
    {
        $row = DB::table("registration_payment_submissions")
            ->where("requester_id", $requesterId)
            ->where("registration_type", $registrationType)
            ->where("status", "approved")
            ->where("is_consumed", false)
            ->orderByDesc("reviewed_at")
            ->orderByDesc("submitted_at")
            ->first();

        return $row ? (array) $row : null;
    }

    public function consumeRegistrationPaymentSubmission(?string $submissionId, ?string $consumedFor, ?string $consumedTargetId): ?array
    {
        $submissionId = trim((string) ($submissionId ?? ""));
        if ($submissionId === "") {
            return null;
        }

        $affected = DB::table("registration_payment_submissions")
            ->where("id", $submissionId)
            ->where("is_consumed", false)
            ->update([
                "is_consumed" => true,
                "consumed_for" => $consumedFor ?: null,
                "consumed_target_id" => $consumedTargetId ?: null,
                "consumed_at" => now(),
            ]);

        if ($affected === 0) {
            return null;
        }

        $row = DB::table("registration_payment_submissions")
            ->where("id", $submissionId)
            ->first();

        return $row ? (array) $row : null;
    }

    public function normalizeIdentifier(mixed $value): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower(trim((string) ($value ?? "")))) ?: "";
    }

    public function isRegulationsControllerUser(array $user, ?string $configuredIdentifier): bool
    {
        $expected = $this->normalizeIdentifier($configuredIdentifier ?: $this->defaultControllingAdminIdentifier());
        if ($expected === "") {
            return false;
        }

        $email = strtolower(trim((string) ($user["email"] ?? "")));
        $emailLocalPart = str_contains($email, "@") ? explode("@", $email)[0] : $email;
        $displayName = strtolower(trim((string) ($user["display_name"] ?? "")));

        $candidates = array_filter([
            $this->normalizeIdentifier($email),
            $this->normalizeIdentifier($emailLocalPart),
            $this->normalizeIdentifier($displayName),
            $this->normalizeIdentifier($user["id"] ?? null),
            $this->normalizeIdentifier($user["auth_uid"] ?? null),
        ]);

        return in_array($expected, $candidates, true);
    }

    public function isMissingRegistrationTablesError(\Throwable $error): bool
    {
        $message = strtolower($error->getMessage());

        return str_contains($message, "registration_payment_submissions")
            || str_contains($message, "registration_regulations");
    }

    public function missingRegistrationTablesMessage(): string
    {
        return "Registration payment tables are missing. Run migration 022_create_registration_payment_controls.sql and retry.";
    }
}
