import io
import zipfile
from app.core.extension_config import (
    EXTENSION_FEATURE_GATES,
    EXTENSION_FEATURE_LABELS,
    EXTENSION_FEATURE_DIRS,
    EXTENSION_ZIP_FOLDER_NAMES,
    get_accessible_features,
    has_any_feature_access,
)
from app.api.v1.extension import build_extension_zip, get_extension_dir


def test_extension_feature_config():
    # Verify all 3 platforms are registered
    assert "linkedin" in EXTENSION_FEATURE_GATES
    assert "indeed" in EXTENSION_FEATURE_GATES
    assert "naukri" in EXTENSION_FEATURE_GATES

    assert EXTENSION_FEATURE_GATES["linkedin"] == ["pro", "elite"]
    assert EXTENSION_FEATURE_GATES["indeed"] == ["elite"]
    assert EXTENSION_FEATURE_GATES["naukri"] == ["elite"]

    assert EXTENSION_FEATURE_LABELS["naukri"] == "Naukri 1-Click Job Copier"
    assert EXTENSION_FEATURE_DIRS["naukri"] == "naukri-job-copier"
    assert EXTENSION_ZIP_FOLDER_NAMES["naukri"] == "RoleCraft-Naukri-1-Click-Job-Copier"


def test_plan_access_gates():
    free = get_accessible_features("free")
    assert free["linkedin"] is False
    assert free["indeed"] is False
    assert free["naukri"] is False
    assert has_any_feature_access("free") is False

    pro = get_accessible_features("pro")
    assert pro["linkedin"] is True
    assert pro["indeed"] is False
    assert pro["naukri"] is False
    assert has_any_feature_access("pro") is True

    elite = get_accessible_features("elite")
    assert elite["linkedin"] is True
    assert elite["indeed"] is True
    assert elite["naukri"] is True
    assert has_any_feature_access("elite") is True


def test_extension_dirs_exist():
    for feature in ["linkedin", "indeed", "naukri"]:
        d = get_extension_dir(feature)
        assert d.exists(), f"Dir missing for {feature}: {d}"
        manifest = d / "manifest.json"
        assert manifest.exists(), f"manifest.json missing for {feature}: {manifest}"
        content_js = d / "content.js"
        assert content_js.exists(), f"content.js missing for {feature}: {content_js}"
        styles_css = d / "styles.css"
        assert styles_css.exists(), f"styles.css missing for {feature}: {styles_css}"
        for icon in ["icon16.png", "icon32.png", "icon48.png", "icon128.png"]:
            assert (d / "icons" / icon).exists(), f"Icon {icon} missing for {feature}"


def test_build_extension_zip_single():
    buf = build_extension_zip({"naukri": True})
    zf = zipfile.ZipFile(buf)
    names = zf.namelist()
    assert len(names) >= 4
    assert any("manifest.json" in n for n in names)
    assert any("content.js" in n for n in names)
    assert any("styles.css" in n for n in names)
    assert all(n.startswith("RoleCraft-Naukri-1-Click-Job-Copier/") for n in names)


def test_build_extension_zip_all_3():
    elite_features = get_accessible_features("elite")
    buf = build_extension_zip(elite_features)
    zf = zipfile.ZipFile(buf)
    names = zf.namelist()
    top_folders = set(n.split("/")[0] for n in names)
    assert top_folders == {
        "RoleCraft-LinkedIn-1-Click-Job-Copier",
        "RoleCraft-Indeed-1-Click-Job-Copier",
        "RoleCraft-Naukri-1-Click-Job-Copier",
        "RoleCraft-Cutshort-1-Click-Job-Copier",
    }


if __name__ == "__main__":
    test_extension_feature_config()
    test_plan_access_gates()
    test_extension_dirs_exist()
    test_build_extension_zip_single()
    test_build_extension_zip_all_3()
    print("All extension tests passed successfully!")
