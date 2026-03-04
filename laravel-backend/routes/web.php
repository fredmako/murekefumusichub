<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['ok' => true]));

$serveStatic = strtolower((string) env('SERVE_STATIC', 'false')) === 'true';
$distDir = realpath(__DIR__ . '/../../dist') ?: (__DIR__ . '/../../dist');
$distIndex = $distDir . DIRECTORY_SEPARATOR . 'index.html';

if ($serveStatic && File::exists($distIndex)) {
    Route::get('/', fn () => response()->file($distIndex));
    Route::get('/{path}', function () use ($distIndex) {
        return response()->file($distIndex);
    })->where('path', '^(?!api).*$');
} else {
    Route::get('/', function () {
        return response()->json([
            'message' => 'Laravel backend is running',
            'hint' => 'Build frontend and set SERVE_STATIC=true to serve dist/',
        ]);
    });
}
