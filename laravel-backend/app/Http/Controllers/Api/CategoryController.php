<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    public function index()
    {
        $rows = DB::table("categories")->orderBy("name")->get();
        return response()->json($rows);
    }

    public function store(Request $request)
    {
        $name = trim((string) $request->input("name", ""));
        if ($name === "") {
            return response()->json(["message" => "name is required"], 400);
        }

        DB::table("categories")->insert([
            "name" => $name,
            "description" => $request->input("description"),
            "created_at" => now(),
        ]);

        $row = DB::table("categories")->where("name", $name)->orderByDesc("id")->first();
        return response()->json([
            "message" => "Category created",
            "category" => $row,
        ], 201);
    }
}
