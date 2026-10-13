package web.id.luxtradee.twa

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Simple settings - can be expanded later
        setTitle(R.string.settings_title)
    }
}
