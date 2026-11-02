package expo.modules.gintiinbox

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * Queues notifications from payment and banking apps so the JS side can turn them into ledger entries.
 * Nothing leaves the phone: entries sit in private SharedPreferences until the app drains them.
 */
class PaymentNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in PAYMENT_APPS) return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
    // Only money movements: skip promos, chats and reminders that carry no amount.
    if (!AMOUNT.containsMatchIn("$title $text")) return
    enqueue(applicationContext, JSONObject().apply {
      put("id", "${sbn.packageName}:${sbn.postTime}:${sbn.id}")
      put("app", sbn.packageName)
      put("title", title)
      put("text", text)
      put("time", sbn.postTime)
    })
  }

  companion object {
    private const val PREFS = "ginti_inbox"
    private const val KEY = "queue"
    private const val MAX = 300
    private val AMOUNT = Regex("(₹|rs\\.?|inr)\\s?[\\d,]+", RegexOption.IGNORE_CASE)

    val PAYMENT_APPS = setOf(
      "com.google.android.apps.nbu.paisa.user", // Google Pay
      "com.phonepe.app",
      "net.one97.paytm",
      "in.org.npci.upiapp", // BHIM
      "in.amazon.mShop.android.shopping", // Amazon Pay
      "com.dreamplug.androidapp", // CRED
      "com.snapwork.hdfc",
      "com.csam.icici.bank.imobile",
      "com.sbi.lotusintouch", // YONO SBI
      "com.axis.mobile",
      "com.msf.kbank.mobile", // Kotak
    )

    @Synchronized
    fun enqueue(context: Context, item: JSONObject) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val queue = JSONArray(prefs.getString(KEY, "[]"))
      queue.put(item)
      val trimmed = JSONArray()
      val start = maxOf(0, queue.length() - MAX)
      for (i in start until queue.length()) trimmed.put(queue.get(i))
      prefs.edit().putString(KEY, trimmed.toString()).apply()
    }

    @Synchronized
    fun drain(context: Context): JSONArray {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val queue = JSONArray(prefs.getString(KEY, "[]"))
      prefs.edit().putString(KEY, "[]").apply()
      return queue
    }
  }
}
