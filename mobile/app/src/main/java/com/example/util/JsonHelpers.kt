package com.example.util

import org.json.JSONObject

/**
 * Safe wrapper around [JSONObject.optString] that filters out the literal string
 * "null" which Android's [org.json.JSONObject.optString] returns when the JSON
 * value is actually null (not the string "null").
 *
 * Usage: val tier = profileData.safeString("academic_tier")
 */
fun JSONObject.safeString(key: String, fallback: String = ""): String {
    val value = this.optString(key, fallback)
    return if (value == "null" || value == "Null" || value == "NULL") fallback else value
}
