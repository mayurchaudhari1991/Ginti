package expo.modules.gintiinbox

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GintiInboxModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("GintiInbox")

    Function("hasSmsPermission") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    /** Inbox messages received after `sinceMs`, newest first. */
    AsyncFunction("readSms") { sinceMs: Double, limit: Int ->
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        return@AsyncFunction emptyList<Map<String, Any?>>()
      }
      val out = mutableListOf<Map<String, Any?>>()
      context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date > ?",
        arrayOf(sinceMs.toLong().toString()),
        "date DESC",
      )?.use { c ->
        val id = c.getColumnIndexOrThrow("_id")
        val address = c.getColumnIndexOrThrow("address")
        val body = c.getColumnIndexOrThrow("body")
        val date = c.getColumnIndexOrThrow("date")
        while (c.moveToNext() && out.size < limit) {
          out.add(
            mapOf(
              "id" to "sms:${c.getLong(id)}",
              "address" to c.getString(address),
              "body" to c.getString(body),
              "time" to c.getLong(date).toDouble(),
            ),
          )
        }
      }
      out
    }

    Function("hasNotificationAccess") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("openNotificationAccessSettings") {
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Returns and clears the payment notifications captured since the last call. */
    Function("drainNotifications") {
      val queue = PaymentNotificationListener.drain(context)
      (0 until queue.length()).map { i ->
        val o = queue.getJSONObject(i)
        mapOf(
          "id" to o.optString("id"),
          "address" to o.optString("app"),
          "body" to "${o.optString("title")} ${o.optString("text")}".trim(),
          "time" to o.optLong("time").toDouble(),
        )
      }
    }
  }
}
