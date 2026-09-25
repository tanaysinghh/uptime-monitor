package com.uptimemonitor.security;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/backupCodes.test.js. */
class BackupCodesTest {

    @Test
    void generatesTenUniqueCodesInXxxxDashXxxxFormat() {
        List<String> codes = BackupCodes.generate();
        assertThat(codes).hasSize(BackupCodes.CODE_COUNT);
        assertThat(new HashSet<>(codes)).hasSize(BackupCodes.CODE_COUNT);
        assertThat(codes).allMatch(c -> c.matches("^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$"));
    }

    @Test
    void hashIsCaseAndDashInsensitive() {
        assertThat(BackupCodes.hash("abcd-efgh")).isEqualTo(BackupCodes.hash("ABCDEFGH"));
    }

    @Test
    void consumeMatchingRemovesExactlyTheUsedCode() {
        List<String> codes = BackupCodes.generate();
        List<String> hashed = codes.stream().map(BackupCodes::hash).toList();
        BackupCodes.ConsumeResult r = BackupCodes.consumeMatching(codes.get(3), hashed);
        assertThat(r.matched()).isTrue();
        assertThat(r.remaining()).hasSize(9).doesNotContain(hashed.get(3));
        assertThat(BackupCodes.consumeMatching(codes.get(3), r.remaining()).matched()).isFalse();
    }

    @Test
    void consumeMatchingReturnsListUntouchedOnMiss() {
        List<String> hashed = BackupCodes.generate().stream().map(BackupCodes::hash).toList();
        BackupCodes.ConsumeResult r = BackupCodes.consumeMatching("ZZZZ-ZZZZ", hashed);
        assertThat(r.matched()).isFalse();
        assertThat(r.remaining()).isEqualTo(hashed);
    }

    @Test
    void hashMatchesNodeImplementation() {
        // sha256("ABCDEFGH") - what backupCodes.hash("abcd-efgh") returns in Node
        assertThat(BackupCodes.hash("abcd-efgh"))
                .isEqualTo("9ac2197d9258257b1ae8463e4214e4cd0a578bc1517f2415928b91be4283fc48");
    }
}
