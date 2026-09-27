package web.id.luxtradee.twa

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class DeeplinkActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val intent = Intent(this, MainActivity::class.java).apply {
            action = this@DeeplinkActivity.intent.action
            data = this@DeeplinkActivity.intent.data
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(intent)
        finish()
    }
}
