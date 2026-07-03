exports.up = (pgm) => {


    // USERS
    pgm.createTable('users', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        name: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });


    // PROFILES
    pgm.createTable('profiles', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        owner_user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        name: { type: 'text', notNull: true },
        relationship: {
            type: 'text',
            notNull: true,
            check: "relationship IN ('self','spouse','parent','child','sibling','other')"
        },
        gender: {
            type: 'text',
            check: "gender IN ('male','female','other','prefer_not_to_say')"
        },
        date_of_birth: { type: 'date' },
        blood_group: {
            type: 'text',
            check: "blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')"
        },
        abha_number: { type: 'text', unique: true },
        abha_address: { type: 'text' },
        abha_linked: { type: 'boolean', default: false },
        is_primary: { type: 'boolean', default: false },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('profiles', 'owner_user_id');


    // REFRESH TOKENS
    pgm.createTable('refresh_tokens', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        token: { type: 'text', notNull: true, unique: true },
        expires_at: { type: 'timestamp', notNull: true },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('refresh_tokens', 'user_id');


    // CAREGIVER ACCESS
    pgm.createTable('caregiver_access', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        profile_id: {
            type: 'uuid',
            notNull: true,
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        caregiver_user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        permissions: {
            type: 'jsonb',
            default: JSON.stringify({
                view_records: true,
                view_care_plans: true,
                manage_reminders: false,
                add_records: false
            })
        },
        status: {
            type: 'text',
            default: 'pending',
            check: "status IN ('pending','active','revoked')"
        },
        invited_at: { type: 'timestamp', default: pgm.func('NOW()') },
        accepted_at: { type: 'timestamp' }
    });

    pgm.addConstraint(
        'caregiver_access',
        'unique_caregiver_profile',
        'UNIQUE(profile_id, caregiver_user_id)'
    );

    pgm.createIndex('caregiver_access', 'profile_id');
    pgm.createIndex('caregiver_access', 'caregiver_user_id');


    // RECORDS
    pgm.createTable('records', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        type: {
            type: 'text',
            notNull: true,
            check: "type IN ('prescription','lab_report')"
        },
        file_name: { type: 'text', notNull: true },
        file_url: { type: 'text', notNull: true },
        file_public_id: { type: 'text', notNull: true },
        notes: { type: 'text' },
        uploaded_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('records', 'user_id');
    pgm.createIndex('records', 'profile_id');


    // CARE PLANS
    pgm.createTable('care_plans', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        record_id: {
            type: 'uuid',
            references: 'records(id)',
            onDelete: 'SET NULL'
        },
        // Status and versioning
        status: {
            type: 'text',
            default: 'active',
            check: "status IN ('active','completed','archived')"
        },
        version: { type: 'integer', default: 1 },
        parent_plan_id: { type: 'uuid' },
        // Duration and progress
        start_date: { type: 'date' },
        end_date: { type: 'date' },
        duration_days: { type: 'integer' },
        progress_percentage: { type: 'integer', default: 0 },
        // AI generated content
        summary: { type: 'text' },
        disclaimer: { type: 'text' },
        raw_ai_output: { type: 'jsonb' },
        // Structured AI outputs
        diet_recommendations: { type: 'jsonb' },
        lifestyle_recommendations: { type: 'jsonb' },
        watch_for_symptoms: { type: 'jsonb' },
        follow_up_appointments: { type: 'jsonb' },
        // Clarification flow
        clarification_status: {
            type: 'text',
            default: 'complete',
            check: "clarification_status IN ('pending_questions','complete')"
        },
        pending_questions: { type: 'jsonb' },
        // Timestamps
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    // Self-referencing FK for parent_plan_id
    pgm.addConstraint(
        'care_plans',
        'fk_care_plans_parent',
        'FOREIGN KEY (parent_plan_id) REFERENCES care_plans(id) ON DELETE SET NULL'
    );

    pgm.createIndex('care_plans', 'user_id');
    pgm.createIndex('care_plans', 'profile_id');


    // CARE PLAN TASKS
    pgm.createTable('care_plan_tasks', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        care_plan_id: {
            type: 'uuid',
            notNull: true,
            references: 'care_plans(id)',
            onDelete: 'CASCADE'
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        title: { type: 'text', notNull: true },
        description: { type: 'text' },
        category: {
            type: 'text',
            check: "category IN ('medication','lifestyle','diet','symptom_check','appointment','general')"
        },
        is_completed: { type: 'boolean', default: false },
        due_date: { type: 'date' },
        completed_at: { type: 'timestamp' },
        sort_order: { type: 'integer', default: 0 },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('care_plan_tasks', 'care_plan_id');


    // MEDICATIONS
    pgm.createTable('medications', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        care_plan_id: {
            type: 'uuid',
            references: 'care_plans(id)',
            onDelete: 'SET NULL'
        },
        name: { type: 'text', notNull: true },
        dosage: { type: 'text' },
        frequency: { type: 'text' },
        timing: { type: 'text' },
        duration: { type: 'text' },
        instructions: { type: 'text' },
        source: {
            type: 'text',
            default: 'manual',
            check: "source IN ('care_plan','manual')"
        },
        is_active: { type: 'boolean', default: true },
        start_date: { type: 'date' },
        end_date: { type: 'date' },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('medications', 'user_id');
    pgm.createIndex('medications', 'profile_id');
    pgm.createIndex('medications', 'care_plan_id');


    // REMINDERS
    pgm.createTable('reminders', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        medication_id: {
            type: 'uuid',
            references: 'medications(id)',
            onDelete: 'CASCADE'
        },
        care_plan_id: {
            type: 'uuid',
            references: 'care_plans(id)',
            onDelete: 'SET NULL'
        },
        care_plan_task_id: {
            type: 'uuid',
            references: 'care_plan_tasks(id)',
            onDelete: 'SET NULL'
        },
        type: {
            type: 'text',
            notNull: true,
            check: "type IN ('medication','appointment','lifestyle','water_intake','exercise','symptom_check','custom')"
        },
        title: { type: 'text', notNull: true },
        description: { type: 'text' },
        scheduled_time: { type: 'time', notNull: true },
        days_of_week: { type: 'text[]' },
        recurrence: {
            type: 'text',
            default: 'daily',
            check: "recurrence IN ('once','daily','weekly','monthly')"
        },
        start_date: { type: 'date' },
        end_date: { type: 'date' },
        is_active: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('reminders', 'user_id');
    pgm.createIndex('reminders', 'profile_id');


    // REMINDER LOGS
    pgm.createTable('reminder_logs', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        reminder_id: {
            type: 'uuid',
            notNull: true,
            references: 'reminders(id)',
            onDelete: 'CASCADE'
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        scheduled_at: { type: 'timestamp', notNull: true },
        status: {
            type: 'text',
            check: "status IN ('taken','missed','snoozed','completed','skipped')"
        },
        notes: { type: 'text' },
        logged_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('reminder_logs', 'reminder_id');
    pgm.createIndex('reminder_logs', 'user_id');


    // VITALS
    pgm.createTable('vitals', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        type: {
            type: 'text',
            notNull: true,
            check: "type IN ('blood_pressure','blood_glucose','weight','temperature','heart_rate','oxygen_saturation')"
        },
        value_primary: { type: 'numeric', notNull: true },
        value_secondary: { type: 'numeric' },
        unit: { type: 'text', notNull: true },
        timing_context: { type: 'text' },
        notes: { type: 'text' },
        recorded_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('vitals', 'user_id');
    pgm.createIndex('vitals', 'profile_id');
    pgm.createIndex('vitals', ['user_id', 'type']);


    // LAB RESULTS
    pgm.createTable('lab_results', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        record_id: {
            type: 'uuid',
            references: 'records(id)',
            onDelete: 'SET NULL'
        },
        parameter: { type: 'text', notNull: true },
        value: { type: 'text', notNull: true },
        unit: { type: 'text' },
        reference_range: { type: 'text' },
        status: {
            type: 'text',
            check: "status IN ('normal','borderline','abnormal')"
        },
        test_date: { type: 'date' },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('lab_results', 'user_id');
    pgm.createIndex('lab_results', 'record_id');


    // SYMPTOM LOGS
    pgm.createTable('symptom_logs', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        care_plan_id: {
            type: 'uuid',
            references: 'care_plans(id)',
            onDelete: 'SET NULL'
        },
        symptom: { type: 'text', notNull: true },
        severity: {
            type: 'text',
            check: "severity IN ('mild','moderate','severe')"
        },
        notes: { type: 'text' },
        logged_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('symptom_logs', 'user_id');
    pgm.createIndex('symptom_logs', 'profile_id');


    // CHAT CONVERSATIONS
    pgm.createTable('chat_conversations', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        profile_id: {
            type: 'uuid',
            references: 'profiles(id)',
            onDelete: 'CASCADE'
        },
        related_care_plan_id: {
            type: 'uuid',
            references: 'care_plans(id)',
            onDelete: 'SET NULL'
        },
        related_record_id: {
            type: 'uuid',
            references: 'records(id)',
            onDelete: 'SET NULL'
        },
        title: { type: 'text' },
        conversation_type: {
            type: 'text',
            default: 'general',
            check: "conversation_type IN ('general','care_plan','lab_report','medication','symptoms')"
        },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
        last_message_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('chat_conversations', 'user_id');
    pgm.createIndex('chat_conversations', 'profile_id');


    // CHAT MESSAGES
    pgm.createTable('chat_messages', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        conversation_id: {
            type: 'uuid',
            notNull: true,
            references: 'chat_conversations(id)',
            onDelete: 'CASCADE'
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users(id)',
            onDelete: 'CASCADE'
        },
        role: {
            type: 'text',
            notNull: true,
            check: "role IN ('user','assistant')"
        },
        content: { type: 'text', notNull: true },
        context_snapshot: { type: 'jsonb' },
        was_flagged: { type: 'boolean', default: false },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') }
    });

    pgm.createIndex('chat_messages', 'conversation_id');
    pgm.createIndex('chat_messages', 'user_id');

};


// DOWN MIGRATION — drops in reverse dependency order
exports.down = (pgm) => {
    pgm.dropTable('chat_messages');
    pgm.dropTable('chat_conversations');
    pgm.dropTable('symptom_logs');
    pgm.dropTable('lab_results');
    pgm.dropTable('vitals');
    pgm.dropTable('reminder_logs');
    pgm.dropTable('reminders');
    pgm.dropTable('medications');
    pgm.dropTable('care_plan_tasks');
    pgm.dropConstraint('care_plans', 'fk_care_plans_parent');
    pgm.dropTable('care_plans');
    pgm.dropTable('records');
    pgm.dropTable('caregiver_access');
    pgm.dropTable('refresh_tokens');
    pgm.dropTable('profiles');
    pgm.dropTable('users');
};