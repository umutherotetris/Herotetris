package tr.heroyun.portal;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class PortalActivity extends Activity {
    private static final Uri PORTAL_HOME = Uri.parse("https://umutherotetris.github.io/Herotetris/");
    private static final int PORTAL_COLOR = 0xfff5f8ff;
    private static final int INK_COLOR = 0xff12224a;
    private static final String CUSTOM_TABS_SERVICE = "android.support.customtabs.action.CustomTabsService";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showBrowserFallback();
        if (savedInstanceState == null) openPortal();
    }

    private Intent portalIntent() {
        // Intentionally ignore inbound Intent data/extras. This launcher opens one canonical HTTPS site.
        return new Intent(Intent.ACTION_VIEW, PORTAL_HOME).addCategory(Intent.CATEGORY_BROWSABLE);
    }

    private void openPortal() {
        // Resolve a generic HTTPS handler so a per-domain app-link association
        // does not stand in for the user's default browser.
        Intent browserQuery = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.invalid/"))
                .addCategory(Intent.CATEGORY_BROWSABLE);
        PackageManager packages = getPackageManager();
        ResolveInfo browser = packages.resolveActivity(browserQuery, PackageManager.MATCH_DEFAULT_ONLY);
        if (browser != null && browser.activityInfo != null) {
            String browserPackage = browser.activityInfo.packageName;
            Intent service = new Intent(CUSTOM_TABS_SERVICE).setPackage(browserPackage);
            if (packages.resolveService(service, 0) != null) {
                Bundle extras = new Bundle();
                // Standard Custom Tabs extras. Null session preserves a normal browser profile.
                extras.putBinder("android.support.customtabs.extra.SESSION", (IBinder) null);
                extras.putInt("android.support.customtabs.extra.TOOLBAR_COLOR", PORTAL_COLOR);
                Intent customTab = portalIntent().setPackage(browserPackage).putExtras(extras);
                if (tryOpen(customTab)) return;
            }
        }
        // The browser can still open the portal when Custom Tabs are unsupported or unavailable.
        tryOpen(portalIntent());
    }

    private boolean tryOpen(Intent intent) {
        try {
            startActivity(intent);
            finish();
            return true;
        } catch (ActivityNotFoundException | SecurityException unavailable) {
            return false;
        }
    }

    private int dp(int units) {
        return Math.round(units * getResources().getDisplayMetrics().density);
    }

    @SuppressWarnings("deprecation")
    private void showBrowserFallback() {
        ScrollView screen = new ScrollView(this);
        screen.setFillViewport(true);
        screen.setBackgroundColor(PORTAL_COLOR);
        int pad = dp(24);
        screen.setPadding(pad, pad, pad, pad);
        screen.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                if (Build.VERSION.SDK_INT >= 30) {
                    Api30.applyPadding(view, insets, pad);
                } else {
                    view.setPadding(pad + insets.getSystemWindowInsetLeft(), pad + insets.getSystemWindowInsetTop(),
                            pad + insets.getSystemWindowInsetRight(), pad + insets.getSystemWindowInsetBottom());
                }
                return insets;
            }
        });
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.hero_portal);
        icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        LinearLayout.LayoutParams iconLayout = new LinearLayout.LayoutParams(dp(84), dp(84));
        iconLayout.bottomMargin = dp(22);
        content.addView(icon, iconLayout);

        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextSize(29);
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        title.setTextColor(INK_COLOR);
        title.setGravity(Gravity.CENTER);
        content.addView(title);

        TextView help = new TextView(this);
        help.setText(R.string.browser_needed);
        help.setTextSize(16);
        help.setTextColor(0xff435579);
        help.setMaxWidth(dp(380));
        help.setLineSpacing(dp(4), 1f);
        help.setGravity(Gravity.CENTER);
        help.setPadding(0, pad, 0, pad);
        content.addView(help);

        Button retry = new Button(this);
        retry.setText(R.string.open_portal);
        retry.setAllCaps(false);
        retry.setTextColor(0xffffffff);
        retry.setBackgroundResource(R.drawable.portal_button);
        retry.setPadding(dp(24), dp(10), dp(24), dp(10));
        retry.setMinHeight(dp(48));
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) { openPortal(); }
        });
        content.addView(retry);
        screen.addView(content);
        setContentView(screen);
    }

    private static final class Api30 {
        static void applyPadding(View view, WindowInsets insets, int pad) {
            Insets system = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            view.setPadding(pad + system.left, pad + system.top, pad + system.right, pad + system.bottom);
        }
    }
}
