"""
Tests for CourseSearchTool.execute()

Run from the backend/ directory:
    uv run pytest test_search_tools.py -v

Integration tests (TestCourseSearchToolIntegration) require the server to have been
started at least once so that chroma_db/ is populated from docs/.  They are skipped
automatically when the database is absent.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unittest.mock import MagicMock, call

from search_tools import CourseSearchTool
from vector_store import SearchResults, VectorStore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_results(docs, metas, distances=None, error=None):
    if error is not None:
        return SearchResults.empty(error)
    distances = distances or [0.1] * len(docs)
    return SearchResults(documents=docs, metadata=metas, distances=distances)


# ---------------------------------------------------------------------------
# Unit tests — mocked VectorStore
# ---------------------------------------------------------------------------

class TestCourseSearchToolExecuteUnit:

    @pytest.fixture(autouse=True)
    def setup(self):
        self.mock_store = MagicMock(spec=VectorStore)
        self.tool = CourseSearchTool(self.mock_store)

    # --- result formatting ---

    def test_single_result_contains_bracketed_course_lesson_header(self):
        self.mock_store.search.return_value = make_results(
            docs=["Claude uses a transformer architecture."],
            metas=[{"course_title": "AI Fundamentals", "lesson_number": 2}],
        )
        self.mock_store.get_lesson_link.return_value = "http://example.com/lesson/2"

        result = self.tool.execute("What architecture does Claude use?")

        assert "[AI Fundamentals - Lesson 2]" in result
        assert "Claude uses a transformer architecture." in result

    def test_multiple_results_all_included_with_double_newline_separator(self):
        self.mock_store.search.return_value = make_results(
            docs=["Content A", "Content B"],
            metas=[
                {"course_title": "Course X", "lesson_number": 1},
                {"course_title": "Course X", "lesson_number": 3},
            ],
        )
        self.mock_store.get_lesson_link.return_value = None

        result = self.tool.execute("test query")

        assert "[Course X - Lesson 1]" in result
        assert "[Course X - Lesson 3]" in result
        assert "Content A" in result
        assert "Content B" in result
        assert "\n\n" in result

    def test_result_with_no_lesson_number_omits_lesson_from_header(self):
        self.mock_store.search.return_value = make_results(
            docs=["Course intro text."],
            metas=[{"course_title": "Standalone Course"}],
        )

        result = self.tool.execute("intro")

        assert "[Standalone Course]" in result
        assert "Lesson" not in result

    # --- parameter passing ---

    def test_passes_all_three_parameters_to_store_search(self):
        self.mock_store.search.return_value = make_results([], [])

        self.tool.execute(query="neural nets", course_name="Deep Learning", lesson_number=5)

        self.mock_store.search.assert_called_once_with(
            query="neural nets",
            course_name="Deep Learning",
            lesson_number=5,
        )

    def test_none_filters_passed_when_args_omitted(self):
        self.mock_store.search.return_value = make_results([], [])

        self.tool.execute(query="anything")

        self.mock_store.search.assert_called_once_with(
            query="anything",
            course_name=None,
            lesson_number=None,
        )

    # --- empty results messages ---

    def test_empty_results_no_filters_returns_generic_no_content_message(self):
        self.mock_store.search.return_value = make_results([], [])

        result = self.tool.execute("obscure topic")

        assert result == "No relevant content found."

    def test_empty_results_with_course_filter_mentions_course_name(self):
        self.mock_store.search.return_value = make_results([], [])

        result = self.tool.execute("something", course_name="Python 101")

        assert "No relevant content found" in result
        assert "Python 101" in result

    def test_empty_results_with_lesson_filter_mentions_lesson_number(self):
        self.mock_store.search.return_value = make_results([], [])

        result = self.tool.execute("something", lesson_number=7)

        assert "No relevant content found" in result
        assert "7" in result

    def test_empty_results_with_both_filters_mentions_both(self):
        self.mock_store.search.return_value = make_results([], [])

        result = self.tool.execute("something", course_name="ML Basics", lesson_number=3)

        assert "No relevant content found" in result
        assert "ML Basics" in result
        assert "3" in result

    # --- error propagation ---

    def test_store_error_string_returned_directly(self):
        self.mock_store.search.return_value = make_results(
            [], [], error="No course found matching 'XYZ'"
        )

        result = self.tool.execute("something", course_name="XYZ")

        assert result == "No course found matching 'XYZ'"

    def test_chromadb_search_exception_surfaced_as_error_string(self):
        self.mock_store.search.return_value = make_results(
            [], [],
            error="Search error: n_results can only be specified if there are at least n_results documents",
        )

        result = self.tool.execute("test")

        assert "Search error" in result

    # --- sources tracking ---

    def test_last_sources_has_label_and_link_after_results(self):
        self.mock_store.search.return_value = make_results(
            docs=["Content"],
            metas=[{"course_title": "AI Course", "lesson_number": 4}],
        )
        self.mock_store.get_lesson_link.return_value = "http://ai-course.com/lesson/4"

        self.tool.execute("test")

        assert len(self.tool.last_sources) == 1
        assert self.tool.last_sources[0]["label"] == "AI Course - Lesson 4"
        assert self.tool.last_sources[0]["link"] == "http://ai-course.com/lesson/4"

    def test_last_sources_link_is_none_when_store_returns_none(self):
        self.mock_store.search.return_value = make_results(
            docs=["Content"],
            metas=[{"course_title": "Some Course", "lesson_number": 1}],
        )
        self.mock_store.get_lesson_link.return_value = None

        self.tool.execute("test")

        assert self.tool.last_sources[0]["link"] is None

    def test_last_sources_unchanged_when_results_empty(self):
        self.tool.last_sources = [{"label": "previous", "link": None}]
        self.mock_store.search.return_value = make_results([], [])

        self.tool.execute("test")

        # _format_results is not called for empty results → last_sources untouched
        assert self.tool.last_sources == [{"label": "previous", "link": None}]

    def test_last_sources_unchanged_on_store_error(self):
        self.tool.last_sources = [{"label": "previous", "link": None}]
        self.mock_store.search.return_value = make_results([], [], error="db crashed")

        self.tool.execute("test")

        assert self.tool.last_sources == [{"label": "previous", "link": None}]

    def test_get_lesson_link_called_with_correct_course_and_lesson(self):
        self.mock_store.search.return_value = make_results(
            docs=["doc"],
            metas=[{"course_title": "My Course", "lesson_number": 9}],
        )
        self.mock_store.get_lesson_link.return_value = None

        self.tool.execute("test")

        self.mock_store.get_lesson_link.assert_called_once_with("My Course", 9)

    def test_get_lesson_link_not_called_when_no_lesson_number_in_metadata(self):
        self.mock_store.search.return_value = make_results(
            docs=["doc"],
            metas=[{"course_title": "My Course"}],
        )

        self.tool.execute("test")

        self.mock_store.get_lesson_link.assert_not_called()

    def test_last_sources_label_uses_course_title_only_when_no_lesson(self):
        self.mock_store.search.return_value = make_results(
            docs=["Content"],
            metas=[{"course_title": "No Lessons Course"}],
        )

        self.tool.execute("test")

        assert self.tool.last_sources[0]["label"] == "No Lessons Course"
        assert self.tool.last_sources[0]["link"] is None

    def test_multiple_results_produce_one_source_entry_each(self):
        self.mock_store.search.return_value = make_results(
            docs=["A", "B", "C"],
            metas=[
                {"course_title": "C1", "lesson_number": 1},
                {"course_title": "C2", "lesson_number": 2},
                {"course_title": "C3", "lesson_number": 3},
            ],
        )
        self.mock_store.get_lesson_link.return_value = None

        self.tool.execute("test")

        assert len(self.tool.last_sources) == 3


# ---------------------------------------------------------------------------
# Integration tests — real ChromaDB on disk
# ---------------------------------------------------------------------------

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")


@pytest.fixture(scope="module")
def real_store():
    if not os.path.exists(CHROMA_PATH):
        pytest.skip("chroma_db/ not found — start the server once to populate it")
    from config import config
    return VectorStore(CHROMA_PATH, config.EMBEDDING_MODEL, config.MAX_RESULTS)


@pytest.fixture(scope="module")
def real_tool(real_store):
    return CourseSearchTool(real_store)


class TestCourseSearchToolIntegration:

    def test_vector_store_is_populated(self, real_store):
        """Catches the case where the DB exists but has no indexed courses."""
        count = real_store.get_course_count()
        titles = real_store.get_existing_course_titles()
        assert count > 0, (
            f"Vector store is empty (0 courses). "
            f"Restart the server so startup_event() indexes docs/."
        )
        assert len(titles) == count

    def test_broad_query_returns_non_empty_string(self, real_tool):
        result = real_tool.execute("What is this course about?")
        assert isinstance(result, str) and len(result) > 0

    def test_broad_query_returns_results_not_empty_message(self, real_tool):
        result = real_tool.execute("What topics does this course cover?")
        assert "No relevant content found" not in result, (
            "Broad query returned no results — content chunks may not be indexed "
            "even though course catalog entries exist."
        )

    def test_broad_query_populates_last_sources(self, real_tool):
        real_tool.execute("Tell me about this course")
        assert len(real_tool.last_sources) > 0, (
            "execute() found results but last_sources is empty — source tracking broken."
        )

    def test_all_sources_have_label_key(self, real_tool):
        real_tool.execute("lesson content overview")
        for src in real_tool.last_sources:
            assert "label" in src, f"Source entry missing 'label': {src}"
            assert isinstance(src["label"], str) and src["label"]

    def test_all_sources_have_link_key(self, real_tool):
        real_tool.execute("introduction to the course")
        for src in real_tool.last_sources:
            assert "link" in src, f"Source entry missing 'link' key: {src}"
            # link can be None or a string — both are valid

    def test_result_contains_bracketed_header(self, real_tool):
        result = real_tool.execute("course overview")
        if "No relevant content found" not in result:
            assert "[" in result and "]" in result, (
                "Results are missing bracketed [Course - Lesson N] headers. "
                "Claude will not be able to produce inline citations."
            )

    def test_partial_course_name_resolves_via_catalog(self, real_store, real_tool):
        titles = real_store.get_existing_course_titles()
        if not titles:
            pytest.skip("No courses indexed")
        # Use the first word of the first title as a partial match
        partial = titles[0].split()[0]
        result = real_tool.execute("What is this course?", course_name=partial)
        assert isinstance(result, str)
        assert "Search error" not in result, f"Search crashed: {result}"

    def test_nonexistent_course_name_returns_string_not_exception(self, real_tool):
        result = real_tool.execute("anything", course_name="ZZZNONONONONEXISTENT")
        assert isinstance(result, str)
        # Should not raise; content doesn't matter as long as it's a string

    def test_lesson_zero_filter_returns_results(self, real_tool):
        result = real_tool.execute("introduction", lesson_number=0)
        assert isinstance(result, str)
        if "No relevant content found" not in result:
            assert "Lesson 0" in result, (
                "Lesson 0 filter returned results but 'Lesson 0' not in headers — "
                "metadata filter may not be working."
            )

    def test_course_and_lesson_combined_filter(self, real_store, real_tool):
        """The $and filter path — this exercises _build_filter's compound branch."""
        titles = real_store.get_existing_course_titles()
        if not titles:
            pytest.skip("No courses indexed")
        partial = titles[0].split()[0]
        result = real_tool.execute("content", course_name=partial, lesson_number=1)
        assert isinstance(result, str)
        assert "Search error" not in result, (
            f"Compound $and filter raised an error: {result}. "
            f"ChromaDB 1.0.x may require explicit $eq operators inside $and."
        )

    def test_smoke_common_queries_do_not_raise(self, real_tool):
        for query in [
            "What is machine learning?",
            "Explain the lesson",
            "What are the main topics?",
            "How does the system work?",
        ]:
            result = real_tool.execute(query)
            assert isinstance(result, str), f"execute() returned non-string for {query!r}"
